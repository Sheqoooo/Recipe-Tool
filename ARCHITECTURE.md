# Architektur

## Weiterentwicklung statt Neubau

Die [Bestandsaufnahme](docs/MIGRATION-CLOUDFLARE.md) beschreibt den Ausgangsstand. Erhalten sind Gestaltung, Navigation, Rezeptsammlung, Korrekturansicht, Export und Einkaufslogik. Die aktive Anwendung liegt jetzt in `web/` und `src/`; die bisherige `static/`-Oberfläche bleibt als eigenständige öffentliche GitHub-Pages-Vorschau erhalten. Es wurde kein UI-Framework eingeführt.

## Laufzeit

```text
Browser → Cloudflare Access → Worker (JWT + Mitgliedschaft + Berechtigung)
                               ├─ ASSETS: gebaute Oberfläche, gleiche Origin
                               ├─ D1: Mitglieder, Rezepte, Zutaten, Schritte, Planung, Importe
                               └─ OpenAI Responses API: strukturierte Rezeptgenerierung
```

`assets.run_worker_first=true` erzwingt die Prüfung auch vor HTML, CSS und JavaScript. Der Worker prüft das Access-JWT selbst mit `jose`: RS256-Signatur über den festen Team-JWKS-Endpunkt, exakter Aussteller, Application Audience, Ablauf und Identitätsfelder. Ein E-Mail-Header ist kein Identitätsnachweis. Das ist bei Static Assets besonders relevant, weil der interne Router `ctx.access` nicht an den Nutzer-Worker weiterreicht. [Cloudflare-Dokumentation](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## Webseitenimport

1. Signierte Identität prüfen, aktives Mitglied in D1 ermitteln.
2. Same-Origin-POST und JSON-Größenlimit prüfen.
3. HTTPS-URL normalisieren; identische gespeicherte Quelle wiederverwenden.
4. Anfragekontingent, Parallelität und Kostenbudget atomar in D1 reservieren.
5. Öffentliche DNS-Antworten und jeden Redirect prüfen; lokale Adressen, Anmeldeziele und die eigene App sperren. Keine feste Quellenliste nötig, optional kann der Betreiber Hosts beschränken. Globales Fetch mit `global_fetch_strictly_public`, ohne private Netzwerk-/Service-Bindings und ohne weitergereichte Credentials verwenden.
6. Höchstens 2 MB HTML laden. `parse5` extrahiert den Kochkern von `schema.org/Recipe` ohne Bilder/Bewertungen/irrelevante Metadaten. Sonst Rezeptkarten, Artikel-/Main-Bereiche und vollständige Zutaten-/Zubereitungsabschnitte bevorzugen. Optionale Beschreibung auf UTF-8-Bytebudget begrenzen; Zutaten/Schritte nicht abschneiden. Höchstens 20 KB Text an die KI; bei weiterhin zu großem oder nicht isolierbarem Kern kontrolliert ablehnen.
7. Offizielles OpenAI-SDK verwendet die Responses API, `store:false`, ein festes JSON Schema und maximal 6.000 Ausgabetokens. Keine automatischen Wiederholungen.
8. Gemeinsames Zod-Schema prüft die Antwort serverseitig. Metrische Grundeinheiten normalisieren, Schritt-/Zutatenreferenzen prüfen und fehlende Angaben erhalten.
9. D1-Batch speichert Rezept, Zutaten, Schritte und Importmetadaten atomar. Kein vollständiges HTML, Transkript oder Modell-Rohobjekt wird gespeichert.
10. Sammlung neu laden; keine obligatorische Bearbeitungsmaske. Korrektur nur nachträglich.

## Gemeinsame Typen und Ausgabe

`src/shared/recipe.ts` definiert das feste Zod-Schema; `src/shared/types.ts` leitet `RecipeData` daraus ab. Backend, D1-Repository und TypeScript-Oberfläche verwenden diese Typen. Unbekannte Portionen/Zeiten/Mengen sind `null`, keine erfundenen Standardwerte. Schritte enthalten `text` und nullbasierte `ingredient_indices`. Die Oberfläche zeigt zu jedem referenzierten Schritt die zugehörigen Zutatenmengen direkt an. Wird dieselbe Zutat in mehreren Schritten verwendet, kennzeichnet sie die zusätzliche Anzeige als Rezeptgesamtmenge; maßgeblich sind dann die bekannten Teilmengen im Schritttext. So wird eine Gesamtmenge nicht irreführend als jede einzelne Teilmenge ausgegeben.

Ein fehlendes Portionenfeld verhindert die Aufnahme in die skalierbare Kochliste, bis es sachlich korrigiert wurde. Volumen-/Gewichtsumrechnung für Cups bleibt eine zutatenabhängige KI-Aufgabe mit Prüfhinweis; einfache g/kg- und ml/l-Normalisierung sowie Einkaufsarithmetik laufen deterministisch.

## D1-Schema

Die versionierte Migration `migrations/0001_shared_cookbook.sql` enthält folgende Tabellen; `0002_recipe_listing_index.sql` ergänzt einen Index auf `recipes(created_at DESC,id DESC)`:

| Tabelle | Zweck |
| --- | --- |
| `members` | E-Mail-Einladung, gebundene Access-Subject-ID, Rolle, Aktivstatus |
| `recipes` | Besitzer, Titel, Beschreibung, Portionen, Zeiten, Quelle, Warnungen, Revision, Zeitstempel |
| `ingredients` | Strukturierte Zutaten in fester Reihenfolge |
| `steps` | Schritte mit Referenzen auf Zutatenpositionen |
| `plan` | Gemeinsam ausgewählte Gerichte und Zielportionen |
| `checked_items` | Gemeinsam abgehakte Einkaufspositionen |
| `imports` | Besitzer, Status, Fehlercode, Lease, Kostenreservierung, Tokenverbrauch und Kostenschätzung |

SQL-Zugriffe verwenden gebundene Parameter. D1-Batches bilden Transaktionen. Rezeptänderungen verwenden Revision und ein internes Mutationstoken, damit eine veraltete Korrektur keine Zutaten eines neueren Stands überschreibt. Tabellenname/ID aus der früheren privaten SQLite-Datei werden nicht automatisch importiert; eine spätere Datenübernahme benötigt einen gesonderten, geprüften Datenmigrationsschritt.

## Rechte

Alle aktiven Mitglieder sehen dieselbe Sammlung und Planung. Alle dürfen importieren. Ein Mitglied darf eigene Rezepte korrigieren, ein Admin alle. Löschen und Mitgliederverwaltung sind Adminaktionen. Eigene Mitgliedschaft/Rolle kann nicht selbst gesperrt/geändert werden; dadurch bleibt beim Verwalten anderer Nutzer ein aktiver Administrator bestehen. Die Cloudflare-Access-Richtlinie und die D1-Mitgliederliste müssen beide Zugang erlauben. Die UI blendet Aktionen passend aus; maßgeblich ist immer die Serverprüfung.

## Video-/Transkriptpfad

YouTube-Links werden erkannt. Ohne bereitgestelltes Transkript wird `TRANSCRIPT_REQUIRED` ausgegeben; es findet kein Videoabruf statt. Der implementierte Adapter akzeptiert nach ausdrücklicher Nutzungsbestätigung ein Transkript bis 20 KB und eine angegebene Videolänge bis 20 Minuten. Die Länge ist Nutzermetadatum, keine unabhängig verifizierte Videoanalyse. Der harte Kosten-/Eingabegrenzwert bleibt die Textgröße.

`Source` trennt Quellengewinnung von Generierung und Speicherung. Ein späterer Audio-/Bildadapter kann dieselbe Pipeline nutzen, benötigt aber eigene Medienvalidierung und Kostenreservierung. Audio- und Frame-Uploads, FFmpeg und automatische YouTube-Untertitel sind in dieser Version **nicht implementiert**. Details und offizielle API-Grenzen: [docs/OPENAI-VIDEO.md](docs/OPENAI-VIDEO.md).

## Begrenzungen

Die Sammlung liefert derzeit maximal 500 Rezepte je Zustandsantwort. Rezeptauswahl, Zutaten und Schritte werden in einem D1-Batch aus derselben begrenzten Auswahl gelesen; Detailtabellen verwenden ihre Rezept-ID-Indizes statt sämtliche Details zurückzugeben. Die Zuordnung im Worker erfolgt einmal über Maps statt wiederholter Vollfilter. Der Listenindex unterstützt die sortierte Auswahl. Eine paginierte Suche ist weiterhin offen; Planung und Häkchen sind gemeinsam. Keine Favoriten/Tags, keine automatische Synonym-/Packungsgrößenauflösung und kein JSON-Reimport. Die Preview ist standardmäßig authentifiziert und ohne DB/Secret schreibgeschützt; produktionsnahe Preview-Daten sind absichtlich nicht vorbereitet.

## Schutz der Quell-URLs

Gemeinsame URL-Validierung in `src/shared/source-url.ts`: bekannte Zugangsschlüssel-Namen, case-/trennzeichen-/kodierungsvarianten und verschachtelte URL-Parameter werden abgewiesen. Sie greift vor dem Abruf, bei Redirects, nach Quellenadaptern sowie direkt im Repository vor Reservierung/Speicherung. API-Sammlung und Importhistorie blenden unzulässige historische Quell-URLs aus, ohne DB-Werte eigenständig zu ändern. Nicht sensible Rezeptparameter bleiben erhalten. Grenzen der heuristischen Erkennung stehen in SECURITY.md.

Live-Nachweis: [manuelle Checkliste](docs/SMOKE-TEST.md), noch nicht ausgeführt. Der automatische YouTube-Videoimport bleibt ein langfristiges Produktziel; Transkriptverarbeitung ist nur ein Zwischenstand.

### Optionale Rezeptbilder
`source-image.ts` extrahiert Bildmetadaten getrennt vom KI-Text. `image.ts` lädt höchstens einen Kandidaten über die vorhandenen URL-/DNS-/Redirect-Schutzregeln. Nach erfolgreicher Rezeptvalidierung wird das Bild im selben D1-Batch wie das Rezept in `recipe_images` gespeichert. Die Sammlung lädt nur Bildmetadaten, keine BLOBs. Ein authentifizierter GET `/api/recipes/:id/image` liefert die Bytes. Migration `0003_recipe_images.sql` erweitert die bestehende D1; keine weitere Ressource.

### Gemeinsame Einkaufskacheln
`src/shared/products.ts` enthält den lokalen Produktkatalog, Suchnormalisierung, Vorschlagsrangfolge, Emoji-Zuordnung und strikte Eingabevalidierung. Browser und Worker verwenden dieselben Typen und Regeln. Neue D1-Tabelle `shopping_items` (Migration 0004): manuelle Einträge mit normalisiert eindeutigem Namen, Freitextmenge, Erledigtstatus, Ersteller und Zeitpunkten. Aktive Mitglieder dürfen alle manuellen Listeneinträge bearbeiten. Atomare Insert-/Upsert-Abfrage begrenzt die gemeinsame Liste inklusive erledigter Einträge auf 500. Änderungen an der Kochliste beeinflussen manuelle Einträge nicht. Rezeptzutaten bleiben separat berechnet, um Mengen und Herkunft zu erhalten; keine automatische Mengenaddition mit Freitextartikeln.

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
5. Explizite Hostfreigabe, öffentliche DNS-Antworten und jeden Redirect prüfen. Keine Credentials weiterleiten.
6. Höchstens 2 MB HTML laden. `parse5` extrahiert bevorzugt `schema.org/Recipe`, sonst sichtbaren Text. Höchstens 20 KB Quelltext an die KI weitergeben.
7. Offizielles OpenAI-SDK verwendet die Responses API, `store:false`, ein festes JSON Schema und maximal 6.000 Ausgabetokens. Keine automatischen Wiederholungen.
8. Gemeinsames Zod-Schema prüft die Antwort serverseitig. Metrische Grundeinheiten normalisieren, Schritt-/Zutatenreferenzen prüfen und fehlende Angaben erhalten.
9. D1-Batch speichert Rezept, Zutaten, Schritte und Importmetadaten atomar. Kein vollständiges HTML, Transkript oder Modell-Rohobjekt wird gespeichert.
10. Sammlung neu laden; keine obligatorische Bearbeitungsmaske. Korrektur nur nachträglich.

## Gemeinsame Typen und Ausgabe

`src/shared/recipe.ts` definiert das feste Zod-Schema; `src/shared/types.ts` leitet `RecipeData` daraus ab. Backend, D1-Repository und TypeScript-Oberfläche verwenden diese Typen. Unbekannte Portionen/Zeiten/Mengen sind `null`, keine erfundenen Standardwerte. Schritte enthalten `text` und nullbasierte `ingredient_indices`. Die Oberfläche zeigt zu jedem referenzierten Schritt die zugehörigen Zutatenmengen direkt an.

Ein fehlendes Portionenfeld verhindert die Aufnahme in die skalierbare Kochliste, bis es sachlich korrigiert wurde. Volumen-/Gewichtsumrechnung für Cups bleibt eine zutatenabhängige KI-Aufgabe mit Prüfhinweis; einfache g/kg- und ml/l-Normalisierung sowie Einkaufsarithmetik laufen deterministisch.

## D1-Schema

Die versionierte Migration `migrations/0001_shared_cookbook.sql` enthält:

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

Die Sammlung liefert derzeit maximal 500 Rezepte je Zustandsantwort; eine paginierte Suche ist ein späterer Schritt. Planung und Häkchen sind gemeinsam. Keine Favoriten/Tags, keine automatische Synonym-/Packungsgrößenauflösung und kein JSON-Reimport. Die Preview ist standardmäßig authentifiziert und ohne DB/Secret schreibgeschützt; produktionsnahe Preview-Daten sind absichtlich nicht vorbereitet.

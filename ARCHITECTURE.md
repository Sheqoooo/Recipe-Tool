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

## Kurzvideo-Linkpfad

`src/shared/video-platform.ts` erkennt explizite Plattformhosts und kanonisiert unterstützte Video-URLs. `source.ts` und `social-description.ts` lesen nur öffentliche Beschreibungen oder höchstens eine darin ausdrücklich verlinkte externe Rezeptseite. DNS-, IP-, Redirect- und Antwortgrößenprüfungen gelten für beide Seiten; ein gemeinsames Abruffenster begrenzt die Arbeit. Keine Plattform-Logins. Bei ausdrücklich aktivierter Videoanalyse können öffentlich erlaubte Playerdaten einen begrenzten temporären MP4-Abruf auslösen.

`Source.provenance` kennzeichnet die flüchtige Grundlage (`description`, `provided_text` oder `public_video`). Die Generierung ergänzt daraus entsprechende Hinweise am Rezept. D1 speichert weiterhin den generischen Quelltyp `web` bzw. den historischen YouTube-Texttyp; keine Migration nötig. `VIDEO_SOURCE_REQUIRED` öffnet erst nach gescheitertem automatischem Import die optionale Textbereitstellung. Keine Uploads. Der automatisch aufgelöste Medienpfad in `public-video.ts` und `video-analysis.ts` ist mit Featureflag plus MEDIA-Binding doppelt gesperrt. Er validiert CDN-Host/DNS, vollständige MP4-Dauer (90 s) und Größe (16 MiB), extrahiert Audio/sechs Bilder nativ und nutzt ausschließlich OpenAI Audio/Responses. Zusätzliche Budgetreservierung erfolgt atomar vor Medien-/KI-Verarbeitung; keine Migration. Ton/Bilder sind Stichproben und keine Garantie eines vollständigen Rezepts. Produktionslaufzeit ist noch nicht geprüft. [Grenzen/Modelle](docs/OPENAI-VIDEO.md).

## Begrenzungen

Die Sammlung liefert derzeit maximal 500 Rezepte je Zustandsantwort. Rezeptauswahl, Zutaten und Schritte werden in einem D1-Batch aus derselben begrenzten Auswahl gelesen; Detailtabellen verwenden ihre Rezept-ID-Indizes statt sämtliche Details zurückzugeben. Die Zuordnung im Worker erfolgt einmal über Maps statt wiederholter Vollfilter. Der Listenindex unterstützt die sortierte Auswahl. Eine paginierte Suche ist weiterhin offen; Planung und Häkchen sind gemeinsam. Keine Favoriten/Tags, keine automatische Synonym-/Packungsgrößenauflösung und kein JSON-Reimport. Die Preview ist standardmäßig authentifiziert und ohne DB/Secret schreibgeschützt; produktionsnahe Preview-Daten sind absichtlich nicht vorbereitet.

## Schutz der Quell-URLs

Gemeinsame URL-Validierung in `src/shared/source-url.ts`: bekannte Zugangsschlüssel-Namen, case-/trennzeichen-/kodierungsvarianten und verschachtelte URL-Parameter werden abgewiesen. Sie greift vor dem Abruf, bei Redirects, nach Quellenadaptern sowie direkt im Repository vor Reservierung/Speicherung. API-Sammlung und Importhistorie blenden unzulässige historische Quell-URLs aus, ohne DB-Werte eigenständig zu ändern. Nicht sensible Rezeptparameter bleiben erhalten. Grenzen der heuristischen Erkennung stehen in SECURITY.md.

Live-Nachweis: [manuelle Checkliste](docs/SMOKE-TEST.md), noch nicht ausgeführt. Der automatische YouTube-Videoimport bleibt ein langfristiges Produktziel; Transkriptverarbeitung ist nur ein Zwischenstand.

### Optionale Rezeptbilder
`source-image.ts` extrahiert Bildmetadaten getrennt vom KI-Text. `image.ts` lädt höchstens einen Kandidaten über die vorhandenen URL-/DNS-/Redirect-Schutzregeln. Nach erfolgreicher Rezeptvalidierung wird das Bild im selben D1-Batch wie das Rezept in `recipe_images` gespeichert. Die Sammlung lädt nur Bildmetadaten, keine BLOBs. Ein authentifizierter GET `/api/recipes/:id/image` liefert die Bytes. Migration `0003_recipe_images.sql` erweitert die bestehende D1; keine weitere Ressource.

### Gemeinsame Einkaufskacheln
`src/shared/products.ts` enthält den lokalen Produktkatalog, Suchnormalisierung, Vorschlagsrangfolge, Emoji-Zuordnung und strikte Eingabevalidierung. Browser und Worker verwenden dieselben Typen und Regeln. Neue D1-Tabelle `shopping_items` (Migration 0004): manuelle Einträge mit normalisiert eindeutigem Namen, Freitextmenge, Erledigtstatus, Ersteller und Zeitpunkten. Aktive Mitglieder dürfen alle manuellen Listeneinträge bearbeiten. Atomare Insert-/Upsert-Abfrage begrenzt die gemeinsame Liste inklusive erledigter Einträge auf 500. Änderungen an der Kochliste beeinflussen manuelle Einträge nicht. Rezeptzutaten bleiben separat berechnet, um Mengen und Herkunft zu erhalten; keine automatische Mengenaddition mit Freitextartikeln.

### Einkaufsweg, direkte Übernahme und App-Einstiege
`shopping-order.ts` ordnet bekannte Namen in feste Abteilungen ein; Vorrats-/TK-Marker haben Vorrang vor Grundzutaten. Unklare Produkte landen sichtbar unter Sonstiges. Ein gemeinsamer Renderer sortiert manuelle Artikel und dynamische Rezeptzutaten zusammen. Die Speicherung bleibt getrennt, um Freitextmengen nicht mit skalierbaren Rezeptmengen zu vermischen.

POST `/api/shopping/from-recipe` liest Originalzutaten serverseitig und übernimmt alle oder explizite Indizes als Snapshot in `shopping_items`. Bekannte Mengen bleiben erhalten; fehlende Mengen heißen „Menge offen“. Erneutes Hinzufügen ersetzt die manuelle Menge und öffnet den bestehenden Namen erneut, ohne ihn zu duplizieren. Gleichnamige Zutaten einer Übernahme werden mit ` + ` als Menge verbunden; keine willkürliche Addition unterschiedlicher Einheiten. Zu lange Namen/Mengen führen vor dem Schreiben zu einem Validierungsfehler. D1-Batches mit höchstens 18 Artikeln je Statement bleiben unter 100 Bindings. Migration 0005 erzwingt das bestehende 500-Artikel-Limit per Trigger, damit Mehrfachimporte bei Überschreitung vollständig zurückrollen.

Der Build erstellt `/recipes/index.html` und `/shopping/index.html`, getrennte Manifest-IDs/Start-URLs und originale PNG-Icons in 180/192/512 Pixeln. Beide greifen auf dieselbe geschützte API zu. Wechsel zwischen den Bereichen nutzt in der echten App deren eigene URLs; die Offline-Demo verwendet weiterhin nur Ansichten im Arbeitsspeicher. Kein Service Worker und kein Cache privater Daten.

### Importierte Suchdaten
`data/catalog/bls.json` und `open-food-facts.json` sind getrennte, öffentlich lizenzierte Auszüge. `search.json` ist die deduplizierte Suchprojektion; `SOURCES.json` enthält Versionen, Hashes und Zählungen. `scripts/import-product-data.py` erzeugt sie deterministisch aus lokal bereitgestellten offiziellen Quelldateien, ohne Netz- oder Datenbankzugriff. Die Anwendung lädt die Suchprojektion im Bundle. Exakte Namens-/Synonymzuordnung verwendet Maps, beschreibende Zusätze kurze Wortgruppen; keine wiederholte Volltextklassifizierung aller 5.000 Begriffe pro Artikel. Kategorien sind Heuristiken. Produktionsbuild enthält zusätzlich herunterladbare, geschützte `/catalog/`-Kopien. Private Nutzerdaten bleiben ausschließlich in D1.

Katalogdaten und Suchindizes laufen nur im Frontend. Gemeinsame Schreibvalidierung liegt separat in shopping-entry.ts; der Worker importiert keine öffentlichen Lebensmittel-Datensätze und baut keine Suchindizes pro Isolat auf.

### Mobile Einkaufsleiste
shopping-dock.ts misst Formular, Navigation und VisualViewport. Gemeinsame reine Geometrie in dock-geometry.ts begrenzt Vorschlagshöhe und berechnet die Position oberhalb der Tastatur. ResizeObserver und Viewport-/Fokusereignisse aktualisieren CSS-Variablen über requestAnimationFrame. Bei sichtbarer Tastatur wird die Navigation ausgeblendet; beim Schließen kehrt sie zurück. Ausreichender Seitenabstand verhindert verdeckte letzte Artikel. Desktop bleibt im normalen Layout.

Der Build erzeugt für die Einkaufstüte transparente sowie hell/dunkel hinterlegte PNGs und einen zusätzlichen Installations-Einstieg `/shopping/dark/` mit derselben Manifest-ID. Kein neuer Worker, keine Datenbankmigration, keine API-/Berechtigungsänderung.

### Ausgewählte Video-Standbilder
Der Video-Responses-Umschlag erweitert ausschließlich den Medienpfad um `cover_frame_index` (0–5 oder null). Die Auswahl wird im selben strukturierten Rezeptaufruf validiert; der normale Textvertrag bleibt unverändert. `extractVideoImage` extrahiert den gewählten Zeitpunkt erneut aus den vorübergehend vorhandenen Originalbytes mit nur einer Zielbreite (960 px), damit kein quadratischer Rand in das Foto eingebrannt wird. Header/Dimensionen und höchstens 1 MiB JPEG werden geprüft. Ein Bildfehler verwirft kein gültiges Rezept. `Generated.image` bleibt ein serverinterner Übergabewert; D1 speichert nur das eine Bild in der bereits vorhandenen `recipe_images`-Tabelle.

POST `/api/recipes/video-image` ergänzt nur fehlende Bilder eigener Rezepte bzw. aller Rezepte für Admins. Der explizite Bildpfad kann die Videoquelle auch bei ausreichender Beschreibung laden, ohne Rezept-KI aufzurufen. Für diese Nachladung und den Bildfallback nach Beschreibungsimport wird ein früher Frame bei 5 % verwendet, keine behauptete KI-Auswahl. Identität, Origin, Besitzer, Plattform, Freischaltung und persistentes Anfragekontingent werden vor dem Abruf geprüft. Die Reservierung begrenzt Missbrauch und bleibt bestehen; verbuchter OpenAI-Verbrauch beträgt null. Vorhandene Bilder bleiben über `ON CONFLICT DO NOTHING` erhalten, auch bei konkurrierenden Anfragen. Keine Migration oder Neuerstellung alter Rezepttexte.

Die Oberfläche setzt das Importformular unmittelbar nach erfolgreicher API-Antwort zurück, bevor die Sammlung erneut geladen wird. Ein gescheiterter Import behält die Eingabe. Optionale Texte und Zustimmung werden gemeinsam mit dem Link gelöscht.

### Optionale kulinarische Importwünsche
`src/shared/adaptation.ts` normalisiert und validiert das optionale API-Feld `adaptation` (höchstens 400 UTF-16-Codeeinheiten; unzulässige Steuerzeichen abweisen, NFC und Leerraum normalisieren). Der Worker prüft es vor Quellenabruf, Reservierung und KI. `Source.adaptation` bleibt über Text-, Transkript- und Videoaufbereitung erhalten. Die zusätzliche letzte Nutzernachricht enthält ausschließlich den validierten Wunsch; Quelldaten bleiben eine getrennte unzuverlässige Nachricht. Feste Entwickleranweisungen erlauben nur kulinarische Änderungen, konsistente Zutaten-/Schrittreferenzen und keine erfundenen numerischen Mengen/Zeiten/Temperaturen. Das bestehende Structured-Outputs-Schema und serverseitige Validierung bleiben unverändert.

Die vorhandene menschlich lesbare Warnung `Nach Nutzerwunsch angepasst: …` dient zugleich als Variantenkennzeichnung. Keine versteckten Hashes, Queryparameter oder neue Tabellenspalte. `Repository.bySource` filtert über den bestehenden Quellenindex und parametrisierte `json_each(warnings_json)`-Prüfungen: Originale ohne Kennzeichnung, Varianten mit exakt passendem normalisiertem Hinweis. KI-generierte Kennzeichnungen werden vor dem Speichern entfernt und ausschließlich aus der validierten Eingabe neu gesetzt. `Repository.edit` erhält die einmal gesetzte Kennzeichnung und erlaubt keine Fälschung über das frei editierbare Warnungsfeld. Dies ist eine bewusste kompatible Lösung ohne Migration; bei späteren komplexeren Variantenbeziehungen wäre eine dedizierte Metadatentabelle sinnvoll.

Reservierung berücksichtigt die zusätzliche Wunsch-/Anweisungslänge vor jedem KI-Aufruf. Kein zweiter Generierungsschritt. Das bestehende Quellen-Parallelitätslimit gilt auch für verschiedene Varianten desselben Links. Die nachträgliche Änderung des Variantenwunsches ist kein Editorfeature; dafür erneut mit anderem Wunsch importieren. Semantische Kochqualität wird durch Modellanweisungen unterstützt, aber nicht durch die formale Schema-/Indexvalidierung bewiesen.

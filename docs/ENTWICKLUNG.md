# Architektur und Entwicklung

Stand: Version 0.2, 9. November 2026.

## Voraussetzungen

Node.js **24.x**, npm und ein schreibbarer Datenordner. SQLite kommt aus `node:sqlite`; es muss kein nativer npm-Datenbanktreiber kompiliert werden. Die Laufzeitabhängigkeiten `parse5` (HTML-Parser) und `ipaddr.js` (IP-Adressklassifikation) sind exakt versioniert und über `package-lock.json` mit Integritätswerten festgehalten.

```sh
npm ci
npm start
```

`npm start` lädt eine optionale `.env` über Node. `node server.js` ohne diesen Parameter erwartet bereits gesetzte Umgebungsvariablen. Alle Einstellungen stehen in [HOSTING.md](HOSTING.md).

## Dateien und Verantwortung

| Datei | Aufgabe |
| --- | --- |
| `server.js` | HTTP-Routen, Host-/Origin-Prüfung, Passwort, Sitzungstoken, Importkoordination |
| `app/source.js` | Öffentliche Quellseiten abrufen, Weiterleitungen prüfen, HTML und schema.org lesen |
| `app/importer.js` | Festes KI-Schema und deutsche Rezeptaufbereitung |
| `app/recipes.js` | Validierung, Einheiten und deterministische Einkaufsberechnung |
| `app/storage.js` | SQLite, atomare Schreibvorgänge und serverseitige Key-Datei |
| `static/` | HTML, CSS und Browser-JavaScript ohne Build-Schritt |
| `tests/*.test.js` | Unit- und API-Integrationstests über Node Test Runner |
| `tests/browser/` | Playwright-Abläufe für Desktop und Mobil |
| `tests/browser-server.js` | Ausschließlich lokale, temporäre Test-App mit simulierter KI |

## Importablauf

```text
Linkfeld → POST /api/import
  → URL normalisieren, vorhandenes Rezept suchen
  → API-Key prüfen
  → öffentliche Quelle lesen (HTML / schema.org)
  → Source {kind, url, text, recipe}
  → KI-Aufbereitung mit festem JSON-Schema
  → validateRecipe
  → SQLite-Transaktion
  → {id, existing} zurückgeben
  → Sammlung neu laden und anzeigen
```

Der Import ist in Bezug auf die Speicherung atomar: Fehler vor der erfolgreichen Validierung erzeugen keinen Rezeptdatensatz. Es gibt keine obligatorische Bearbeitungsmaske. API-Fehler werden nicht automatisch wiederholt. Maximal zwei unterschiedliche Importe laufen gleichzeitig; gleiche URLs teilen eine Promise. Diese Koordination gilt für eine Serverinstanz, nicht für mehrere Replikate.

## Datenmodell

Ein Rezept enthält `title`, `description`, `servings`, `ingredients`, `steps`, `warnings`, `source_url`, `source_kind` und `original_text`. Persistierte Rezepte erhalten `id` und `created_at`. Eine Zutat besteht aus `name`, `amount` (Zahl oder `null`), `unit` und `note`.

Validierung: Titel, positive Portionenzahl, mindestens eine benannte Zutat und ein Schritt; endliche, begrenzte Zahlen und begrenzte Text-/Array-Längen. Maße werden bei der Validierung normalisiert. KI-Provenienzfelder werden mit den tatsächlich abgerufenen Quelldaten überschrieben. Bei Korrekturen bleiben ursprünglicher Quelltext und Quellenart erhalten.

| SQLite-Tabelle | Inhalt |
| --- | --- |
| `recipes` | Rezeptdokument als JSON, ID, Erstellungszeit |
| `plan` | Ausgewählte Rezept-ID und gewünschte Portionen |
| `checked_items` | Schlüssel abgehakter Einkaufspositionen |

Schema `user_version=1` bleibt mit Version 0.1 kompatibel. Fremdschlüssel sind aktiv, das Löschen eines Rezepts entfernt seinen Kochlisteneintrag. Schreibvorgänge erfolgen in Transaktionen. WAL-Modus erlaubt konsistentes SQLite-Verhalten; für Dateibackups die App stoppen und den vollständigen Datenordner sichern. Für spätere Schemaänderungen müssen versionierte Migrationen ergänzt werden.

## HTTP-API

Alle API-Antworten sind JSON, Fehler haben `{error: "…"}`. Hosting-Passwortschutz gilt für Oberfläche und API. Alle POSTs brauchen den Token aus `/api/state` im Header `X-Rezeptwerk-Token` und `Content-Type: application/json`.

| Route | Verhalten |
| --- | --- |
| `GET /health` | Nicht vertraulicher Healthcheck ohne Passwort |
| `GET /api/state` | Sammlung, Plan, Einkaufsliste, Häkchen, Key-Status und Sitzungstoken; nie den API-Key |
| `POST /api/import` | `{value: "https://…"}`; importiert und speichert; 201 bei neuem Rezept, 200 bei vorhandenem Link; liefert `{id, existing}` |
| `POST /api/recipes/save` | Vollständiges Rezept mit bestehender `id`; ausschließlich nachträgliche Korrektur |
| `POST /api/recipes/delete` | `{id}`; entfernt Rezept und Planung |
| `POST /api/plan` | `{recipe_id, servings}` oder `{recipe_id, remove: true}` |
| `POST /api/shopping/check` | `{key, checked}`; Schlüssel muss in aktueller Einkaufsliste existieren |
| `POST /api/settings` | `{api_key}`; leer entfernt den gespeicherten Key; durch Umgebung verwaltete Keys nicht überschreibbar |

Dateien außerhalb der festen Liste `/`, `/app.js`, `/style.css` werden nicht ausgeliefert. Der JSON-Export entsteht im Browser aus dem Zustand; ein Reimport ist nicht enthalten.

## Sicherheit und Datenschutz

- Standardbindung: `127.0.0.1`. Öffentliches Binden oder `NODE_ENV=production` erfordert HTTPS-`APP_URL` und `APP_PASSWORD` mit mindestens 16 Zeichen. Der HTTPS-Abschluss erfolgt beim Hosting/Reverse Proxy.
- HTTP-Basic-Passwortschutz für den persönlichen Einbenutzerbetrieb. Benutzername `rezeptwerk`. Kein öffentliches Registrierungs- oder Mehrbenutzersystem.
- Hostnamen werden mit der konfigurierten Domain abgeglichen; POST-Origin muss zur App passen. Weiterleitungsheader werden nicht zur Freischaltung fremder Hosts ausgewertet.
- Zufälliger Sitzungstoken schützt Schreibzugriffe zusätzlich. Token und Passwort gelten nur für die eigene Instanz.
- Der Linkabruf erlaubt HTTP/HTTPS und Port 80/443. Alle DNS-Antworten müssen öffentliche Unicast-Adressen sein. Jede Weiterleitung wird erneut geprüft. HTTP-Verbindungen verwenden die geprüfte IP; TLS prüft den ursprünglichen Hostnamen.
- Quellseiten sind auf 2 MB, KI-Inhalte auf 40.000 Zeichen und JSON-Anfragen auf 300 KB begrenzt. Quellabrufe haben Zeitlimits, ebenso KI-Anfragen.
- HTML aus Quellen wird nicht im Browser ausgeführt. Browserausgaben werden maskiert, die Content Security Policy beschränkt Ressourcen auf die App.
- Keys liegen ausschließlich serverseitig: Umgebungsvariable oder atomar geschriebene Datei mit `0600`. Kein Access-Logging von Rezepten oder Schlüsseln; interne Fehlermeldungen werden nicht an Clients ausgegeben.
- Bei einem KI-Aufruf werden Quelldaten an OpenAI übertragen. `store: false` ersetzt nicht deren Datenbedingungen.

## Tests

```sh
npm run check
npm test
```

Die Tests prüfen Import/Validierung, fehlende Keys und unvollständige KI-Antworten, DNS/Redirect-Sperren, Speicherung und Neustart, Portionsskalierung, Häkchen, Korrektur, Duplikate, parallele Importe, Passwort und Host-/Origin-Prüfung.

Für Browsertests nach Installation der regulären Pakete:

```sh
npm install --no-save --package-lock=false --ignore-scripts @playwright/test@1.56.1
npx playwright install chromium
npx playwright test
```

Der Testserver nutzt eine temporäre Datenbank und simulierte Quell-/KI-Ergebnisse. Desktop und Mobil prüfen den Ablauf Link → Sammlung ohne Dialog → Kochliste → Portionsänderung → Häkchen nach Neuladen → nachträgliche Korrektur. Screenshots entstehen in `test-results/`. GitHub Actions führt diese Tests und einen Docker-Build aus und stellt Browser-Artefakte bereit.

Es sind keine echten API-Aufrufe Bestandteil der Tests. Die persönliche API-Verbindung und das tatsächliche Hosting werden nach deren Einrichtung gesondert geprüft.

# Technischer Aufbau und Entwicklung

Stand: 9. November 2026. Die Beschreibung bezieht sich auf den vorhandenen Code. Geplantes Verhalten steht in [PRODUKT.md](PRODUKT.md).

## Voraussetzungen und Start

Python 3.9 oder neuer mit SQLite- und HTTPS-Unterstützung. Alle Python-Module stammen aus der Standardbibliothek. Kein npm-Build und keine Paketinstallation erforderlich.

```sh
python3 server.py
```

Die Anwendung bindet ausschließlich an `127.0.0.1`, standardmäßig Port `8765`. Die Browseroberfläche ist unter `http://127.0.0.1:8765` erreichbar. Beenden mit `Strg+C`.

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `PORT` | Lokaler HTTP-Port | `8765` |
| `REZEPTWERK_DATA` | Ordner für Datenbank und Einstellungen | `data` im Projektordner |
| `OPENAI_API_KEY` | Optionaler API-Key; hat Vorrang vor den Einstellungen | Nicht gesetzt |

`.env`-Dateien werden nicht automatisch geladen. Ein API-Key kann alternativ über die Oberfläche eingegeben werden. Der Server muss bei Änderungen am Python-Code neu gestartet werden; statische Dateien werden bei jeder Anfrage neu gelesen.

## Module und Datenfluss

```text
Browser (static/index.html, app.js, style.css)
  → lokale HTTP-API (server.py)
  → read_source (app/importer.py)
      → öffentliches HTML abrufen
      → schema.org/Recipe suchen, sonst sichtbaren Text übernehmen
  → Source(kind, text, url, recipe)
  → prepare_recipe
      → optional OpenAI-Aufruf mit festem JSON-Schema
      → aktuell: Entwurf zum Browser zurückgeben
  → aktuell: separates Speichern aus der Bearbeitungsmaske
  → validate_recipe (app/recipes.py)
  → SQLite (app/storage.py)

Kochliste + Rezepte → shopping_list → gemeinsame Einkaufsliste
```

Der Import speichert derzeit noch nicht selbst. Für den vereinbarten automatischen Ablauf müssen Aufbereitung, Validierung und Speicherung im Importpfad verbunden und die obligatorische Entwurfsmaske entfernt werden. Die vorhandene Bearbeitung kann für spätere Korrekturen weiterverwendet werden.

## Rezeptmodell

Ein Rezept enthält `title`, `description`, `servings`, `ingredients`, `steps`, `warnings`, `source_url`, `source_kind` und `original_text`. Persistierte Rezepte erhalten zusätzlich `id` und `created_at`.

Eine Zutat enthält:

| Feld | Inhalt |
| --- | --- |
| `name` | Produktname ohne Menge und Einheit |
| `amount` | Nicht negative Zahl oder `null` bei unbekannter Menge |
| `unit` | Einheit, beispielsweise `g`, `ml`, `Stück`, `EL`, `TL` |
| `note` | Hinweise, Unsicherheiten oder alternative Mengen |

Die Validierung verlangt einen Titel, eine positive Portionenzahl, mindestens eine Zutat und einen Zubereitungsschritt. Zahlen müssen endlich sein. Mengen und Textlängen sind begrenzt. Einheiten wie kg/l werden in g/ml normalisiert. Die Einkaufsberechnung verwendet keine KI.

## SQLite-Tabellen

| Tabelle | Aufgabe |
| --- | --- |
| `recipes` | JSON-Rezeptdokumente, ID und Erstellungszeit |
| `plan` | Ein Eintrag je ausgewähltem Rezept mit Zielportionen |
| `checked_items` | Schlüssel abgehakter Einkaufspositionen |

`plan.recipe_id` referenziert `recipes.id` mit `ON DELETE CASCADE`. Kochlistenänderungen und gespeicherte Rezeptänderungen setzen Häkchen zurück. Das initiale Schema trägt `PRAGMA user_version = 1`; vor künftigen Schemaänderungen sind versionierte Migrationen zu ergänzen.

## Lokale API

Antworten sind JSON, außer bei statischen Dateien. Fehler enthalten `{"error":"…"}` mit einem passenden HTTP-Status. Schreibzugriffe benötigen den Sitzungstoken aus `/api/state` im Header `X-Rezeptwerk-Token`.

| Methode und Pfad | Aufgabe / Eingabe |
| --- | --- |
| `GET /api/state` | Rezepte, Kochliste, Einkaufsliste, Häkchen, Key-Status und Sitzungstoken; kein API-Key |
| `POST /api/import` | `{kind: "url" oder "text", value: "…"}`; liefert aktuell einen ungespeicherten Entwurf |
| `POST /api/recipes/save` | Vollständiges Rezeptdokument; optional `id` zum Bearbeiten; liefert gespeicherte ID |
| `POST /api/recipes/delete` | `{id: …}`; entfernt Rezept und zugehörige Planung |
| `POST /api/plan` | `{recipe_id: …, servings: …}`; setzt Zielportionen; mit `remove: true` entfernen |
| `POST /api/shopping/check` | `{key: "…", checked: true oder false}` |
| `POST /api/settings` | `{api_key: "…"}`; leerer Wert entfernt den lokal gespeicherten Schlüssel |

`GET /` liefert die Oberfläche; nur `/app.js` und `/style.css` sind weitere öffentliche Dateien. Andere Dateipfade werden nicht ausgeliefert. Der JSON-Export wird im Browser aus dem geladenen Zustand erzeugt.

## Sicherheits- und Datenschutzentscheidungen

- Nur lokale Netzwerkbindung und feste Host-Prüfung; keine öffentliche Mehrbenutzeranwendung.
- Schreibzugriffe erfordern einen zufälligen Sitzungstoken; fremde Origins werden abgewiesen.
- HTML-Ausgaben im Browser werden maskiert. Die Content Security Policy beschränkt Skripte, Styles und Verbindungen auf die App.
- Quellabrufe unterstützen nur HTTP/HTTPS auf Port 80/443. Interne oder nicht global routbare IPs werden blockiert. Jede Weiterleitung wird geprüft und die Verbindung an die geprüfte IP gebunden; HTTPS prüft weiterhin den ursprünglichen Hostnamen.
- Maximal 2 MB pro Quellseite und 40.000 Zeichen für die KI-Quelle; zu große Inhalte werden abgewiesen oder beim Textimport begrenzt.
- Der Key wird serverseitig in `data/settings.json` mit Dateirechten `0600` gespeichert. Er ist nicht verschlüsselt. Er wird nie als Teil des Zustands an den Browser gesendet.
- Beim KI-Import wird der Quelltext an OpenAI gesendet. `store: false` ist gesetzt; es ersetzt nicht die Datenbedingungen des API-Anbieters.
- Keine Rezeptinhalte, URLs oder Credentials in Zugriffslogs.
- `.gitignore` schließt persönliche Daten, Schlüsseldateien, `.env` und Laufzeitdateien aus.

## Tests und bekannte Prüfgrenzen

```sh
python3 -m unittest discover -v
```

Der aktuelle Stand enthält 22 Tests. Sie prüfen Zutatenparser, Brüche und Einheiten, unsichere Mengenbereiche, Skalierung und Zusammenführung, schema.org-Erkennung, blockierte Quelladressen, KI-Anfrageformat, Persistenz, Dateirechte sowie den Speichern-/Planen-/Abhaken-/Löschen-Ablauf über einen echten lokalen Testserver. Testdaten liegen vorübergehend unter `.runtime` und werden entfernt. API-Aufrufe sind simuliert und kostenfrei.

Noch nicht verifiziert sind echte OpenAI-Antworten mit einem persönlichen Key und die visuelle Browserbedienung. Die Browserautomatisierung scheiterte an der Ausführungsumgebung; eine zusätzliche JavaScript-Syntaxprüfung konnte wegen fehlender Freigabe nicht laufen. Die Tests sind kein Nachweis für den noch nicht implementierten automatischen Link-Ablauf.

## Erweiterung um Videoquellen

Ein künftiger Adapter soll Videozugang, Transkription und gegebenenfalls Bildauswertung übernehmen und ein `Source`-Objekt liefern. Dadurch können Rezeptaufbereitung, Validierung, Speicherung und Einkaufsliste weiterverwendet werden. Vor der Implementierung müssen Quellenzugriff, Kostenbegrenzung, Upload-Verhalten und Umgang mit unklaren Mengen konkretisiert werden. Es existiert derzeit kein Video-Download oder -Analysepfad.

## Sicherung und Wiederherstellung

Die App beenden und den Ordner `data` sichern. Zum Wiederherstellen bei beendeter App zurückkopieren. Der Ordner kann den API-Key enthalten und ist entsprechend privat zu behandeln. Der JSON-Export enthält nur die Rezeptsammlung; er ersetzt keine vollständige Sicherung. Ein JSON-Reimport ist noch nicht implementiert.

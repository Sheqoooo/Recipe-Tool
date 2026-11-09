# Rezeptwerk

Eine lokale, quelloffene Rezeptsammlung mit deutscher KI-Aufbereitung und gemeinsamer Einkaufsliste. Kein App-Konto und kein Cloud-Datenbankdienst. Python 3.9 oder neuer genügt; es sind keine zusätzlichen Python-Pakete erforderlich.

## Starten

```sh
python3 server.py
```

Anschließend **http://127.0.0.1:8765** im Browser öffnen. Auf macOS lässt sich alternativ `Start.command` doppelklicken. Beenden im Terminal mit `Strg+C`. Der Rechner muss nur während der Nutzung laufen.

## Erste Schritte

1. Unter **Einstellungen** einen OpenAI-API-Key hinterlegen. Dieser Schritt ist optional; manuelle Rezepte funktionieren ohne Key.
2. Einen Rezeptlink oder vollständigen Rezepttext einfügen. Text kann auch aus einer Instagram-Beschreibung stammen.
3. Den Entwurf prüfen, fehlende Angaben ergänzen und speichern. Originaltext und Quelle bleiben erhalten.
4. In **Meine Rezepte** Gerichte zur Kochliste hinzufügen.
5. In **Einkaufsliste** Portionen anpassen und Zutaten abhaken oder offene Zutaten kopieren.

Ohne API-Key liest der Linkimport vorhandene `schema.org/Recipe`-Daten aus. Er übersetzt dann nicht automatisch. Ohne strukturierte Daten wird ein leerer Entwurf mit dem Originaltext zur manuellen Erfassung geöffnet. Nicht jede Webseite erlaubt automatisches Abrufen; bei blockierten Seiten den Text einfügen.

## KI und Kosten

Die KI-Anbindung nutzt derzeit `gpt-5.4-mini` über die OpenAI Chat Completions API mit festem JSON-Schema und `store: false`. Bei jedem KI-Import wird der ausgelesene Rezepttext an OpenAI übertragen; deren API-Datenbedingungen gelten weiterhin. Datenbank und Einkaufslistenberechnung bleiben lokal. Es gibt keine Analyse- oder Trackingdienste, keine extern geladenen Schriftarten und keine automatischen KI-Hintergrundanfragen.

Ein ChatGPT-Plus-Abo bezahlt die API-Nutzung nicht. API-Zahlungen/Guthaben werden separat eingerichtet. Fehlende Zutatenmengen werden nicht ergänzt; KI-Umrechnungen und Rezeptangaben müssen vor dem Speichern geprüft werden.

Den Key in den Einstellungen eingeben oder vor dem Start als `OPENAI_API_KEY` setzen. Ein Umgebungsschlüssel hat Vorrang. Die lokale Schlüsseldatei `data/settings.json` wird mit Dateirechten `0600` gespeichert und nicht an den Browser zurückgegeben. Sie ist nicht verschlüsselt. Schlüssel, Datenbanken und Laufzeitdateien werden durch `.gitignore` vom Repository ausgeschlossen.

## Daten und Sicherung

- `data/recipes.sqlite3`: Rezepte, Originaltexte, Kochliste und abgehakte Zutaten.
- `data/settings.json`: optionaler lokaler API-Key.
- Unter **Einstellungen → Rezepte exportieren** lässt sich die Sammlung als JSON exportieren. Ein JSON-Reimport ist noch nicht implementiert.
- Für eine vollständige Sicherung die Anwendung beenden und den Ordner `data` kopieren. Zum Wiederherstellen bei beendeter App zurückkopieren. Die Sicherung enthält gegebenenfalls den API-Key.
- Identische Zutatennamen und kompatible Einheiten werden addiert; g/kg und ml/l werden vereinheitlicht. Produktvarianten, unterschiedliche Hinweise und unbekannte Mengen bleiben getrennt. Synonyme und Packungsgrößen werden nicht automatisch aufgelöst.
- Änderungen an Kochliste oder Rezepten setzen Häkchen zurück, damit geänderte Mengen nicht als bereits eingekauft gelten.

## Aufbau

```text
server.py          Lokaler HTTP-Server und API, nur 127.0.0.1
app/importer.py    Quellenadapter, schema.org, KI-Aufbereitung
app/recipes.py     Validierung, Einheiten und Einkaufslistenberechnung
app/storage.py     SQLite und lokale Einstellungen
static/           Oberfläche ohne Build-Schritt
tests/            Offline-Tests
```

Der Server prüft Host und Schreibzugriffe mit einem Sitzungstoken. Der Linkabruf blockiert interne IP-Adressen und prüft jede Weiterleitung; Verbindungen werden an die geprüfte öffentliche IP gebunden. Die App ist für die persönliche lokale Nutzung ausgelegt, nicht zur unveränderten Veröffentlichung im Internet.

`PORT` ändert den lokalen Port; `REZEPTWERK_DATA` den Datenordner. Beispiel: `PORT=8766 python3 server.py`.

## Tests

```sh
python3 -m unittest discover -v
```

Die Tests verwenden keinen echten API-Key und verursachen keine API-Kosten.

## Video später ergänzen

`Source` in `app/importer.py` ist die gemeinsame Übergabe zwischen Quellen und Rezeptaufbereitung. Ein späterer Video-Adapter kann Transkript und erkannte Einblendungen in `Source.text` liefern und denselben Prüf- und Speicherprozess verwenden. Video-Upload, Transkription und automatischer Instagram-Abruf sind in dieser Version noch nicht implementiert. Instagram-Links zeigen einen Hinweis zum Textimport.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Der App-Code ist Open Source; die optionale OpenAI-API ist ein externer Dienst.

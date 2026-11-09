# Rezeptwerk

**Rezeptlink einfügen → automatisch auf Deutsch aufbereiten → direkt in der Sammlung speichern.** Aus ausgewählten Gerichten wird eine gemeinsame Einkaufsliste mit anpassbaren Portionen.

Oberfläche: HTML, CSS und JavaScript. Server: JavaScript mit Node.js 24. Datenbank: SQLite. Open Source unter MIT-Lizenz. Kein Python, kein App-Konto und kein externer Datenbankdienst nötig.

## Lokal starten

Voraussetzung: **Node.js 24.x mit npm**.

```sh
npm ci
npm start
```

Anschließend **http://127.0.0.1:8765** öffnen. Beenden mit `Strg+C`. Unter macOS kann nach der einmaligen Installation der Pakete auch `Start.command` verwendet werden.

## Verwenden

1. In **Einstellungen** einmal den persönlichen OpenAI-API-Key hinterlegen. Alternativ `OPENAI_API_KEY` auf dem Server setzen.
2. Den Link zu einer Rezept-Webseite einfügen und **Rezept importieren** klicken.
3. Die App liest das Rezept aus, übersetzt und strukturiert es und speichert es direkt. Es öffnet sich keine Pflichtmaske zum Bearbeiten oder Bestätigen.
4. In **Meine Rezepte** gespeicherte Rezepte ansehen oder bei Bedarf nachträglich korrigieren.
5. Rezepte zur Kochliste hinzufügen, Portionen wählen und in **Einkaufsliste** Zutaten abhaken oder kopieren.

Ein bereits gespeicherter identischer Link wird wiedererkannt, auch bei geändertem URL-Fragment. Dabei fällt kein weiterer KI-Aufruf an. Andere URLs zum gleichen Rezept werden nicht automatisch erkannt.

Fehlt ein API-Key, ist die Quelle nicht zugänglich oder wird kein vollständiges Rezept erkannt, wird kein leerer Datensatz angelegt. Nicht jede Rezeptseite erlaubt automatisches Auslesen. JavaScript-gerenderte Seiten werden noch nicht in einem Browser ausgeführt. Instagram und Videoanalyse sind zurückgestellt.

## Online betreiben

**GitHub Pages kann diese App nicht betreiben**, da es keinen Node.js-Server ausführt. Benötigt wird ein Hosting mit Node.js 24 oder Docker und dauerhaftem Datenspeicher. Die App wird an einer eigenen Domain oder Subdomain ohne URL-Unterpfad betrieben.

Die vollständigen Schritte stehen in [docs/HOSTING.md](docs/HOSTING.md), einschließlich Docker Compose, Umgebungsvariablen, HTTPS, Passwortschutz und Backups. Ein Onlinebetrieb benötigt keine starke KI-Hardware; die KI-Anfragen gehen an die OpenAI-API.

## KI, Daten und Kosten

- Bei einem Import sendet der Server den ausgelesenen Rezepttext an OpenAI. Standardmodell: `gpt-5.4-mini`; festes JSON-Schema und `store: false`.
- OpenAI ist ein externer Dienst. Die Anbieter-Datenbedingungen gelten; `store: false` bedeutet nicht automatisch keine Aufbewahrung durch den Anbieter.
- API-Nutzung wird separat vom ChatGPT-Plus-Abo bezahlt. Es werden keine kostenpflichtigen KI-Aufrufe im Hintergrund oder automatische Wiederholungen gestartet.
- Rezeptdaten, Originaltext, Quelle, Kochliste und Häkchen liegen in `data/recipes.sqlite3` auf deinem App-Server.
- Der optionale gespeicherte Key liegt in `data/settings.json` mit Dateirechten `0600`, unverschlüsselt. Er wird nicht an den Browser zurückgegeben. Ein Umgebungsschlüssel hat Vorrang.
- `.gitignore` schließt Schlüssel, `.env`, Datenbanken, Abhängigkeiten und Laufzeitdateien aus. Keine Tracker, externen Schriftarten oder Bilddienste.
- Gramm/Kilogramm und Milliliter/Liter werden für die Einkaufsliste vereinheitlicht. Produktvarianten, unterschiedliche Hinweise und unbekannte Mengen bleiben getrennt. Synonyme und Packungsgrößen werden nicht automatisch aufgelöst.
- KI-Angaben können falsch sein. Unsichere Umrechnungen und fehlende Mengen bleiben als Hinweise sichtbar; die nachträgliche Korrektur ist dafür vorgesehen.

## Dokumentation

- [Produktanforderungen und Grenzen](docs/PRODUKT.md)
- [Architektur, API und Entwicklung](docs/ENTWICKLUNG.md)
- [Hosting und Backups](docs/HOSTING.md)
- [Änderungsverlauf](CHANGELOG.md)

## Entwicklung und Tests

```sh
npm run check
npm test
```

GitHub Actions führt zusätzlich Desktop-/Mobil-Browsertests und einen Docker-Build aus. Die Test-KI ist simuliert; Tests benötigen keinen persönlichen Key und verursachen keine API-Kosten. Echte OpenAI-Aufrufe sind erst nach Einrichtung eines Keys zu prüfen.

## Daten aus Version 0.1 übernehmen

Den alten Python-Prozess zuerst beenden. Den bisherigen `data`-Ordner bei beendeter Anwendung sichern und für die Node-Anwendung weiterverwenden. Datenbankname und Schema bleiben kompatibel. Die App niemals gleichzeitig in beiden Versionen auf derselben Datenbank betreiben. Abgehakte Einkaufspositionen können durch die neue Schlüsselbildung neu erscheinen; die nächste Planänderung setzt Häkchen ohnehin zurück.

## Lizenz

[MIT](LICENSE). HTML-Parser und IP-Adressprüfung sind Open-Source-Abhängigkeiten; deren Lizenzen bleiben erhalten. Die optionale OpenAI-API ist kein quelloffener Bestandteil der Anwendung.

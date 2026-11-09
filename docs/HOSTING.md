# Hosting und Betrieb

## Was das Hosting unterstützen muss

**Node.js 24.x oder Docker**, einen dauerhaft laufenden App-Prozess, ausgehendes HTTPS und einen **dauerhaft beschreibbaren Datenträger**. Eine öffentliche Domain/Subdomain mit HTTPS muss auf die App zeigen. Reines HTML-/PHP-Webspace und GitHub Pages reichen nicht.

Es wird keine GPU benötigt. Die KI läuft über die externe API. SQLite liegt im eigenen Datenverzeichnis. Die Anwendung wird als einzelne Instanz betrieben; mehrere Replikate mit unabhängigen Datenordnern würden unterschiedliche Sammlungen erzeugen.

## Variante A: Node.js-Hosting

1. Repository auschecken und Node.js 24 auswählen.
2. Installationsbefehl: `npm ci --omit=dev --ignore-scripts`.
3. Startbefehl: `npm start`.
4. Einen persistenten Datenträger einrichten und dessen absoluten Pfad in `REZEPTWERK_DATA` setzen.
5. Domain und HTTPS im Hosting einrichten. Die App erwartet die Domain-Wurzel, keinen Pfad wie `/Recipe-Tool`.
6. Die folgenden Umgebungsvariablen setzen und die Anwendung starten.

| Variable | Beispiel / Bedeutung |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` bei App-Hosting; `127.0.0.1` bei lokalem Reverse Proxy auf demselben Server |
| `PORT` | Vom Hoster vorgegeben, sonst `8765` |
| `APP_URL` | Tatsächliche öffentliche HTTPS-Adresse, z. B. `https://rezepte.example.de` |
| `APP_PASSWORD` | Eigenes zufälliges Passwort, mindestens 16 Zeichen, kein Doppelpunkt |
| `REZEPTWERK_DATA` | Absoluter Pfad zum persistenten Datenträger, z. B. `/var/lib/rezeptwerk` |
| `OPENAI_API_KEY` | Optional hier setzen, alternativ später in den App-Einstellungen |
| `OPENAI_MODEL` | Optional; Standard `gpt-5.4-mini` |

In Hosting-Einstellungen eingetragene Schlüssel gehören nicht ins Repository. Alternativ lokal `.env.example` nach `.env` kopieren und ausfüllen; `.env` bleibt ausgeschlossen. Für alle Schlüssel ein eigenes Hosting-Secret verwenden, sofern der Anbieter das unterstützt.

Beim ersten Öffnen fragt der Browser nach Zugangsdaten: Benutzername **`rezeptwerk`**, Passwort aus `APP_PASSWORD`. Das ist ein persönlicher Zugriffsschutz und kein zusätzliches Benutzerkonto.

## Variante B: Docker Compose auf einem Server

Voraussetzung: Docker mit Compose, HTTPS-Reverse-Proxy und Domain. Die beigefügte Compose-Datei bindet den App-Port nur an die lokale Serveradresse. Der Reverse Proxy veröffentlicht die HTTPS-Adresse.

1. Repository auschecken.
2. Eine private `.env` anlegen:

```dotenv
APP_URL=https://rezepte.example.de
APP_PASSWORD=hier-ein-eigenes-langes-zufaelliges-passwort
OPENAI_API_KEY=sk-dein-persoenlicher-key
```

3. Starten:

```sh
docker compose up -d --build
```

4. Reverse Proxy auf `http://127.0.0.1:8765` richten und den ursprünglichen HTTP-Host beibehalten. Ein Import kann über eine Minute dauern; das Proxy-Antwortzeitlimit sollte mindestens 180 Sekunden betragen.

Beispiel für einen auf dem Host installierten Caddy:

```caddy
rezepte.example.de {
    reverse_proxy 127.0.0.1:8765 {
        transport http {
            response_header_timeout 180s
        }
    }
}
```

DNS muss auf den Server zeigen und HTTPS erreichbar sein. Die genaue Domain-/Proxy-Einrichtung hängt vom Hosting ab und wird nach Auswahl des Anbieters angepasst.

Der Container läuft als unprivilegierter Benutzer `node`; das benannte Volume `rezeptwerk-data` enthält `/app/data`. Secrets gelangen nicht ins Docker-Image. Bei eigenen Bind-Mounts müssen Dateirechte für diesen Benutzer passen.

## Prüfung nach Veröffentlichung

- `https://deine-domain/health` liefert `{"ok":true}`. Dieser Endpunkt enthält keine persönlichen Daten und benötigt kein Passwort.
- Die Startseite und `/api/state` verlangen das App-Passwort.
- Nach Eingabe des API-Keys einen echten Rezeptlink importieren: Er erscheint ohne Bearbeitungsdialog in der Sammlung.
- Rezept zur Kochliste hinzufügen, Portionen ändern und Einkaufsliste prüfen.
- Nach App-Neustart muss die Sammlung erhalten bleiben. Fehlen Daten, stimmt der persistente Speicherpfad nicht.

Für einen Testimport fallen die normalen API-Verbrauchskosten an. Automatisierte Tests verwenden simulierte KI und benötigen keine Secrets.

## Updates und Backups

Vor Updates die Anwendung stoppen und den vollständigen Datenordner bzw. das Docker-Volume sichern. Anschließend neue Dateien aus GitHub holen, `npm ci` ausführen und neu starten; bei Compose `docker compose up -d --build` verwenden. Ein normaler Container-Neubau erhält das benannte Datenvolume.

**`docker compose down -v` löscht das Datenvolume** und gehört nicht zum normalen Updateablauf.

Der Ordner enthält SQLite-Datenbank und gegebenenfalls deren WAL-Dateien sowie `settings.json` mit dem gespeicherten API-Key. Backups privat halten. Bei Wiederherstellung die Anwendung stoppen, Daten zurückspielen, Rechte prüfen und neu starten. Bei Nutzung eines Umgebungsschlüssels diesen separat im Hosting wiederherstellen.

Der JSON-Export der App enthält Rezepte, aber weder Kochliste noch Key und ist kein vollständiges Betriebsbackup. Ein JSON-Reimport ist noch nicht implementiert.

## GitHub Pages

Das Repository enthält den Anwendungscode und die Dokumentation. Der Einstieg `index.html` im Hauptverzeichnis öffnet auf GitHub Pages die gestaltete Oberflächenvorschau unter `static/index.html?preview=1`. Relative Ressourcenpfade funktionieren auch unter dem Projektpfad `/Recipe-Tool/`. `.nojekyll` lässt GitHub die statischen Dateien unverändert veröffentlichen.

Die Vorschau benötigt keinen Server und führt keine API-Aufrufe aus; Import und Key-Eingabe sind gesperrt. GitHub Pages kann daraus keine vollständige App starten. Die vollständige Website wird auf dem Node-/Docker-Hosting veröffentlicht; GitHub bleibt die Quellcodeverwaltung.

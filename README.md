# Rezeptwerk / Recipe-Tool

Private gemeinsame Rezeptsammlung: **Link einfügen → auf Deutsch aufbereiten → direkt speichern**. Zutaten, metrische Mengen, bekannte Zeiten und Schritte mit Zutatenmengen werden strukturiert dargestellt. Gemeinsam ausgewählte Gerichte ergeben eine skalierbare Einkaufsliste.

## Stack und Funktionen

- Cloudflare Workers mit Static Assets; Oberfläche aus bestehendem HTML/CSS und TypeScript, kein neues UI-Framework.
- Cloudflare D1 mit versionierten relationalen SQL-Migrationen.
- Cloudflare Access mit zusätzlicher kryptografischer JWT-Prüfung im Worker.
- Explizit eingeladene Mitglieder; eigene Rezepte bearbeiten, Admins verwalten alle und dürfen löschen.
- Offizielles OpenAI-SDK, Responses API, Structured Outputs und serverseitige Zod-Validierung.
- Persistente Anfrage-, Parallelitäts- und Kostenlimits; Importhistorie mit Verbrauchsschätzungen.
- Suche, Korrektur, Portionsskalierung, gemeinsame Häkchen und Rezept-JSON-Export.
- YouTube-Transkriptimport nach Nutzungsbestätigung; **kein automatischer Abruf beliebiger Videos oder fremder Untertitel**.

## Lokal entwickeln

Node.js 24 und npm:

```sh
npm ci
npm run build
npm run db:migrate:local
npm run dev
```

`http://127.0.0.1:8787` öffnen. Lokale D1-Emulation und lokale Test-Adminidentität; keine produktive Datenbankverbindung. Ohne OpenAI-Key kann die Oberfläche und Sammlung geprüft werden, aber kein echter KI-Import. Automatisierte Tests benötigen keinen Key. Nur für einen ausdrücklich freigegebenen echten Import selbst `.dev.vars.example` nach `.dev.vars` kopieren und dort den eigenen Key hinterlegen. Nicht mit `--remote` oder öffentlichem Tunnel starten.

## Eigene Cloudflare-Installation

Andere Betreiber benötigen eigene Cloudflare-Ressourcen, eine Access-Anwendung und einen eigenen OpenAI-API-Key. Dieses Projekt enthält keinerlei produktive Zugangsdaten. Für diese konkrete Installation existiert bereits eine manuell angelegte D1: **keine zweite produktive Datenbank erstellen**.

`wrangler.production.jsonc` enthält Platzhalter für die bestehende D1, Domain und Access-Audiences. Defaults für lokale Entwicklung stehen separat in `wrangler.jsonc`. Produktionsmigrationen und Deployments sind voneinander getrennte, explizit bestätigte Betreiberaktionen. GitHub Actions führt nur Tests aus. Workers Builds soll erst nach Konfiguration und Nutzerfreigabe an `main` angeschlossen werden.

Vollständige Anleitung: [DEPLOYMENT.md](DEPLOYMENT.md).

## Secrets und Daten

`OPENAI_API_KEY` gehört ausschließlich in ein Worker Secret. Kein Key-Eingabefeld in der privaten App und kein Key im Browser-Bundle. Lokale Variablendateien, Datenbankkopien und Buildausgaben sind ignoriert. Bei OpenAI-Aufrufen werden nur begrenzte Quelldaten übertragen; `store:false` ist gesetzt. Vollständige Webseiten/Transkripte werden nicht dauerhaft gespeichert. Details: [SECURITY.md](SECURITY.md).

Portionen, Zeiten und Mengen dürfen unbekannt sein. Die KI soll diese nicht erfinden. Unsicherheiten bleiben sichtbar; sachliche Modellfehler sind trotz Schema möglich. Cups werden nur zutatenabhängig in Gewicht umgerechnet. Vorbereitungs-/Kochzeit bleiben leer, wenn die Quelle sie nicht nennt.

## Webseiten und YouTube

Webseiten müssen explizit über exakte Hostnamen freigegeben sein. schema.org-Rezeptdaten werden bevorzugt; sonst wird sichtbarer Text extrahiert. Interne Adressen, ungültige Redirects und zu große Quellen werden abgewiesen. Dynamisch gerenderte oder blockierte Seiten können nicht immer importiert werden.

YouTube-Links werden erkannt und benötigen derzeit ein rechtmäßig bereitgestelltes Transkript (max. 20 KB, angegebene Videolänge bis 20 Minuten). Es findet keine Bild-/Audioanalyse statt. Die modulare `Source`-Übergabe erlaubt spätere sichere Audio-/Frameadapter; diese sind noch nicht implementiert. [Mediengrenzen und Kosten](docs/OPENAI-VIDEO.md).

## Tests

```sh
npm run build
npm run typecheck
npm test
npm run build:worker
```

Tests verwenden die lokale Workers-/D1-Laufzeit und gemockte Quellen/KI. `build:worker` ist ausschließlich ein Wrangler-Dry-Run. Browserprüfung mit lokalem Fixture-Worker:

```sh
npx wrangler d1 migrations apply DB --local --config test/wrangler.browser.jsonc --persist-to .runtime/browser
npx playwright install chromium
npm run test:browser
```

Die Fixture ersetzt Quellabruf und KI; es entstehen keine API-Kosten und es werden keine produktiven Ressourcen benötigt. Die CI enthält denselben Pfad. Den aktuellen Prüfnachweis enthält der Migrations-PR.

## Dokumentation

- [ARCHITECTURE.md](ARCHITECTURE.md): Datenfluss, Schema, Rechte und Designentscheidungen
- [SECURITY.md](SECURITY.md): Authentifizierung, Secrets, SSRF, Kosten und bekannte Risiken
- [DEPLOYMENT.md](DEPLOYMENT.md): bestehende D1, Access, Worker Secrets, Builds, Previews und Backups
- [AGENTS.md](AGENTS.md): dauerhafte Entwicklungs- und Freigaberegeln
- [Bestandsaufnahme](docs/MIGRATION-CLOUDFLARE.md), [OpenAI-/Video-Prüfung](docs/OPENAI-VIDEO.md), [CHANGELOG.md](CHANGELOG.md)

## Öffentliche Pages-Vorschau und alte Daten

Die bestehende GitHub-Pages-Version bleibt unverändert eine statische Vorschau. Sie ist nicht mit der privaten D1 oder OpenAI verbunden. Die private App läuft später auf der Access-geschützten Worker-Domain. Die alten Node-/Docker-Anleitungen sind durch die Cloudflare-Anleitung ersetzt; die vorherige Version bleibt in der Git-Historie nachvollziehbar.

Bestehende private SQLite-Dateien werden nicht automatisch in D1 übertragen. Vor einem gesonderten Datenimport sind Sicherung, Prüfung der Quellstruktur und ausdrückliche Freigabe erforderlich. Keine echten Rezepte in GitHub speichern.

## Lizenz

[MIT](LICENSE). Die Anwendung ist Open Source; Cloudflare und die optionale OpenAI-API sind externe Dienste mit eigenen Bedingungen und Abrechnung.

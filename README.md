# Futterluke / Recipe-Tool

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

`wrangler.production.jsonc` verwendet die bestehende D1 `recipe-prod` mit eingetragener kostenloser `workers.dev`-Adresse und Cloudflare Access. Selbsthoster ersetzen die Ressourcenkennungen und Access-Werte durch ihre eigenen; `OPENAI_API_KEY` und `BOOTSTRAP_ADMIN_EMAILS` werden ausschließlich als Production Worker Secrets hinterlegt. Defaults für lokale Entwicklung stehen separat in `wrangler.jsonc`. Produktionsmigrationen und Deployments sind voneinander getrennte, explizit bestätigte Betreiberaktionen. GitHub Actions führt nur Tests aus. Workers Builds soll erst nach Konfiguration und Nutzerfreigabe an `main` angeschlossen werden.

Vollständige Anleitung: [DEPLOYMENT.md](DEPLOYMENT.md).

## Secrets und Daten

`OPENAI_API_KEY` gehört ausschließlich in ein Worker Secret. Kein Key-Eingabefeld in der privaten App und kein Key im Browser-Bundle. Lokale Variablendateien, Datenbankkopien und Buildausgaben sind ignoriert. Bei OpenAI-Aufrufen werden nur begrenzte Quelldaten übertragen; `store:false` ist gesetzt. Vollständige Webseiten/Transkripte werden nicht dauerhaft gespeichert. Details: [SECURITY.md](SECURITY.md).

Portionen, Zeiten und Mengen dürfen unbekannt sein. Die KI soll diese nicht erfinden. Unsicherheiten bleiben sichtbar; sachliche Modellfehler sind trotz Schema möglich. Cups werden nur zutatenabhängig in Gewicht umgerechnet. Vorbereitungs-/Kochzeit bleiben leer, wenn die Quelle sie nicht nennt.

## Webseiten und Kurzvideo-Links

Öffentlich erreichbare HTTPS-Rezeptseiten können ohne vorherige Domainfreigabe importiert werden. Eine leere `RECIPE_ALLOWED_HOSTS`-Variable ist der Standard; eine nicht leere Liste kann den Import optional auf exakte Hostnamen beschränken. schema.org-Rezeptdaten werden auf Titel, Zutaten, Schritte, Portionen und Zeiten reduziert; große Bewertungen, Bilder und andere Metadaten werden ausgelassen. Ohne strukturierte Daten werden Rezeptkarten und erkennbare Zutaten-/Zubereitungsabschnitte gegenüber Seitentext bevorzugt. Maximal 2 MB HTML und 20 KB extrahierter Text; der eigentliche Rezeptkern wird nicht still gekürzt. Interne Adressen, ungültige Redirects und zu große Quellen werden abgewiesen. Dynamisch gerenderte oder blockierte Seiten können nicht immer importiert werden.

Kurzvideo-Links werden auf öffentlich zugängliche Rezeptbeschreibungen oder höchstens eine verlinkte Rezeptseite geprüft. Unterstützte Linkformen: YouTube/Shorts, Instagram-Reels/Posts und TikTok. Falls kein ausreichender Text zugänglich ist, wird die Grenze klar angezeigt; eine optionale bereitgestellte Beschreibung oder ein Transkript bleibt als Zwischenstand möglich. Keine Video-Uploads. Ein optionaler Medienpfad (lokal standardmäßig aus, in der Produktionskonfiguration für die Veröffentlichung eingeschaltet) bereitet öffentlich erreichbare Instagram-/TikTok-MP4s über Cloudflare Media Transformations für OpenAI Audio und Vision auf. Er ist noch nicht produktiv erprobt; YouTube-Ton/Bild und blockierte Medien bleiben eingeschränkt. [Mediengrenzen und Modellempfehlung](docs/OPENAI-VIDEO.md).

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
- [Prüfnachweis mit CI-Ergebnissen und ausdrücklich ungetesteten Teilen](docs/VALIDATION.md)

## Öffentliche Pages-Vorschau und alte Daten

Die bestehende GitHub-Pages-Version bleibt unverändert eine statische Vorschau. Sie ist nicht mit der privaten D1 oder OpenAI verbunden. Die private App läuft später auf der Access-geschützten `workers.dev`-Adresse (Frontend und API gemeinsam, keine eigene Domain nötig). Die alten Node-/Docker-Anleitungen sind durch die Cloudflare-Anleitung ersetzt; die vorherige Version bleibt in der Git-Historie nachvollziehbar.

Bestehende private SQLite-Dateien werden nicht automatisch in D1 übertragen. Vor einem gesonderten Datenimport sind Sicherung, Prüfung der Quellstruktur und ausdrückliche Freigabe erforderlich. Keine echten Rezepte in GitHub speichern.

## Lizenz

[MIT](LICENSE). Die Anwendung ist Open Source; Cloudflare und die optionale OpenAI-API sind externe Dienste mit eigenen Bedingungen und Abrechnung.

## Manuelle Prüfung nach Veröffentlichung

Die konkrete [Smoke-Test-Checkliste](docs/SMOKE-TEST.md) umfasst Access einschließlich Assets/API/Preview, bestehende D1 und beide Migrationen, Quellen-/URL-Sicherheit, echte OpenAI-Imports nach gesonderter Kostenfreigabe sowie Koch- und Einkaufsliste. Sie ist vorbereitet, aber noch nicht live abgearbeitet.

## Design ohne API-Kosten testen

`npm run demo` startet eine separate lokale Design-Demo mit Beispielrezepten und simuliertem Import. Ohne D1, Cloudflare-Konto oder OpenAI-Key. Alternativ die portable `rezeptwerk-demo.html` aus dem CI-Artefakt `design-demo` im Browser öffnen. Produktionsbuild und Daten bleiben getrennt. [Bedienung, Mengenanzeige und Grenzen](docs/DESIGN-DEMO.md).

### Futterluke: Rezeptbilder
Die Oberfläche heißt Futterluke, mit dem Untertitel „Umwandlung von Rezepten“. Neue Webseitenimporte übernehmen nach Möglichkeit ein Bild aus Recipe-/Open-Graph-/Twitter-Metadaten. Bilder erscheinen in Sammlung und Rezept, mit Link zur Quellseite und vorhandenem Bildnachweis. Ohne geeignetes Bild bleibt das Emoji. Keine zusätzlichen KI-Aufrufe. Details: [Rezeptbilder](docs/RECIPE-IMAGES.md).

### Einkaufsliste mit Kacheln
Eigene Lebensmittel und Haushaltsartikel lassen sich unabhängig von Rezepten hinzufügen, mit Freitextmenge bearbeiten, abhaken, entfernen und erneut verwenden. Vorschläge aus einem eingebauten deutschen Katalog, eigenen Einträgen und Rezeptzutaten erscheinen direkt beim Tippen. Emojis werden lokal zugeordnet; unbekannte Produkte erhalten 🛒. Dafür werden keine OpenAI-Anfragen benötigt. Die Liste ist für aktive Mitglieder gemeinsam; Aktualisierungen anderer Geräte erscheinen nach Neuladen. Details: [Einkaufsliste](docs/SHOPPING.md).

### Zwei verbundene Bereiche und iOS
Startseite mit direkten Schaltflächen für Kochbuch und Einkaufsliste. Produktiv sind beide zusätzlich unter `/recipes/` und `/shopping/` erreichbar, mit eigenen App-Manifesten und weißen Home-Bildschirm-Symbolen (Zitrone bzw. Einkaufswagen). In Safari den jeweiligen Bereich öffnen → Teilen → Zum Home-Bildschirm. Access bleibt für alle Dateien erforderlich. Noch kein Offline-Betrieb der privaten App. Details: [iOS](docs/IOS.md).

Vorschläge werden beim Antippen oder mit Pfeiltaste + Enter direkt gespeichert. Offene eigene Artikel und Rezeptzutaten erscheinen gemeinsam nach Einkaufsbereichen, alphabetisch innerhalb eines Bereichs. Jeder Zutat im Rezept lässt sich einzeln oder über „Alle Zutaten hinzufügen“ als Mengenkopie übernehmen. Die unabhängige Einkaufsliste benötigt weder Rezeptplanung noch OpenAI-Key. Recherche zur Sortierung und zu Lebensmitteldaten: [Datenquellen](docs/PRODUCT-DATA.md).

### Importierter Produktkatalog
Die lokale Suche enthält 5.160 unterschiedliche Lebensmittelbegriffe aus BLS 4.0 und der deutschen Open-Food-Facts-Zutatentaxonomie, ergänzt um Haushaltsartikel. Die Auswahl ist bereinigt und versioniert; keine Live-Abfrage oder KI beim Tippen. Rohlabels, IDs, Quellversionen, Hashes und Lizenzen liegen unter [data/catalog](data/catalog/README.md). Quellcode bleibt MIT; importierte Daten haben eigene CC-BY-/ODbL-Bedingungen. Nicht das komplette Markenartikelsortiment.

### Mobile Einkaufseingabe und Symbol
Auf Smartphones bleibt die Einkaufseingabe am unteren Bildschirmrand über der Navigation; Vorschläge öffnen nach oben. Die sichtbare Bildschirmfläche bei geöffneter Tastatur wird berücksichtigt. Desktop behält das Eingabefeld im Seitenfluss. Das Einkaufssymbol ist jetzt eine gefüllte Tüte mit Lebensmitteln. Die Zitrone bleibt unverändert. Für iOS bei Bedarf das alte Home-Symbol entfernen und neu hinzufügen; unter `/shopping/dark/` ist eine ausdrücklich dunkle Icon-Variante verfügbar. Beide Einstiege nutzen dieselbe App-ID und Datenbank.

Die Einkaufsliste beginnt mit einer kompakten Überschrift und direkt den Produktkategorien. Der frühere Untertitel wurde entfernt. Artikelzahl, Kopieren, Quellen-/Lizenzhinweise und Sortiererklärung stehen am Ende der Liste und bleiben beim Scrollen erreichbar; die mobile Eingabe bleibt unten fixiert.

Neue Importe verwenden GPT-6.1 Sol mit geringem Denkaufwand und Mengen in Klammern im Anweisungssatz. Die zusätzliche Zutatenklammer am Schrittende entfällt auch bei bestehenden Rezepten. Alte Rezepttexte werden nicht kostenpflichtig neu generiert. Details und Kostenbeispiel: [OpenAI-Integration](docs/OPENAI-VIDEO.md).

### Videovorschaubilder und freie Importmaske
Neue Audio-/Bildimporte wählen innerhalb der bestehenden Rezept-Antwort zusätzlich einen geeigneten der sechs Frames aus (oder keinen, wenn ungeeignet). Ein begrenzter Media-Abruf speichert ein echtes JPEG aus diesem Zeitpunkt samt Originalquelle in der vorhandenen Bildtabelle. Kein zusätzlicher OpenAI-Bildgenerierungsaufruf. Bei reinem Beschreibungsimport und fehlendem Bild kann ein frühes Videostandbild ergänzt werden, sofern öffentlich zugänglich.

Bereits gespeicherte bildlose Instagram-/TikTok-Rezepte bieten Besitzern/Administratoren **Videovorschaubild laden**. Dieser bewusste Nachladevorgang verwendet ein Standbild bei 5 % der Videolänge, ohne OpenAI-Aufruf oder Änderung der Rezepttexte. Vorhandene Bilder werden nicht ersetzt. Keine automatische rückwirkende Verarbeitung aller Rezepte. Hochkant-Standbilder erscheinen in Kacheln zugeschnitten, im geöffneten Rezept vollständig eingepasst und mit Quellenhinweis. Ohne öffentlich erreichbares Video bleibt der Emoji-Platzhalter.

Nach erfolgreichem Import (auch bei bereits gespeichertem Link) werden URL und optionale Transkriptdaten sofort zurückgesetzt. Fehlgeschlagene Importe behalten die Eingabe für eine Korrektur.

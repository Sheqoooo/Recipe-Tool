# Futterluke 🍋

Private gemeinsame Rezeptsammlung: **Link einfügen → auf Deutsch aufbereiten → speichern**. Bekannte Mengen werden metrisch normalisiert; verständliche Arbeitsschritte enthalten die Mengen direkt in Klammern. Zutaten lassen sich einzeln über **+** an eine gemeinsame Bring!-Liste senden.

## Funktionen

- Reduzierte, mobile Oberfläche mit Rezeptimport, Suche, Rezeptansicht, Bildern, optionalen Anpassungswünschen und nachträglicher Korrektur.
- Gemeinsames Kochbuch mit serverseitigen Mitglieder-/Administratorrechten und JSON-Export.
- Öffentliche Rezeptseiten: strukturierte Rezeptdaten bevorzugen, begrenzten Rezeptinhalt extrahieren, OpenAI Responses API mit Structured Outputs und zusätzlicher Validierung.
- Öffentliche Instagram-/TikTok-Quellen: Beschreibung bevorzugen, verfügbare öffentliche Medien begrenzt auswerten. Kein Login-/DRM-/Plattformschutz-Umgehen. Automatische YouTube-Medien sind eingeschränkt; rechtmäßig bereitgestellter Text bleibt eine Alternative.
- Bring! einmal mit Worker Secrets einrichten und als Administrator eine gemeinsame Zielliste auswählen. Die Plus-Schaltfläche neben jeder Zutat sendet ausschließlich diese Zutat samt gespeicherter Menge. Fehlende Mengen bleiben „Menge offen“. Kein Sammelversand und keine KI-Kosten für Bring!.
- Futterluke in Safari zum Home-Bildschirm hinzufügen; das Zitronensymbol bleibt erhalten.

## Technik

TypeScript, HTML/CSS, Cloudflare Workers + Static Assets, D1 (SQLite), Cloudflare Access und ausschließlich OpenAI für KI. Frontend und Backend unter derselben geschützten `workers.dev`-Origin. Kein VPS und kein eigener Datenbankserver.

## Lokal entwickeln

Voraussetzung: Node.js gemäß `package.json` und npm. Im Projektverzeichnis:

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Danach `http://127.0.0.1:8787` öffnen. Lokale D1 statt produktiver Daten. Secrets bei Bedarf nur in ignorierter `.dev.vars`; `.dev.vars.example` enthält ausschließlich Platzhalter. Keine echten OpenAI-Tests ohne gesonderte Freigabe.

```sh
npm run typecheck
npm test
npm run build
npm run build:worker
```

Browserprüfungen verwenden lokale Datenbank und Mocks; die exakte Vorbereitung steht in `.github/workflows/test.yml`.

## Kostenfreie Design-Demo

```sh
npm run demo
```

Alternativ `npm run build:demo`: Die Datei `.runtime/demo/rezeptwerk-demo.html` funktioniert offline mit Beispieldaten und simuliertem Bring!-Ziel. Sie sendet keine Anfragen an OpenAI oder Bring!. Die produktive App enthält keine Demo-Daten.

## Selbst hosten

Eigener Cloudflare-Account, eigene D1, Cloudflare Access und eigener OpenAI-API-Key sind nötig. Ein ChatGPT-Abo enthält kein OpenAI-API-Guthaben. Secrets niemals in GitHub oder Browser-Code eintragen. Konfiguration, bestehende Datenbankanbindung, GitHub-Builds und manuelle Migrationen: [DEPLOYMENT.md](DEPLOYMENT.md). Produktionsmigrationen laufen niemals automatisch beim Deployment.

Bring! ist eine optionale **inoffizielle** Anbindung. Server-Secrets: `BRING_EMAIL`, `BRING_PASSWORD`, `BRING_CLIENT_KEY`. Bei Apple-Anmeldung ist zusätzlich ein Bring!-Passwort erforderlich. Vorschauen erhalten keine produktiven Secrets/D1. Alle Mitglieder senden an dieselbe von Administratoren ausgewählte Liste; keine automatische Synchronisation, kein Löschen oder Abhaken in Bring!.

## Archiv der früheren Einkaufsliste

Die interne Einkaufsliste, Kochplanung, Suche/Emojis und Kataloge liegen als eingefrorener Quellstand unter [archive/shopping-list](archive/shopping-list/README.md). Der Build importiert oder kopiert nichts daraus. Alte Einkaufs-URLs leiten nach erfolgreicher Anmeldung zum Kochbuch um; frühere Einkaufs-API-Routen und Katalog-Assets sind deaktiviert. Bestehende Tabellen und gespeicherte Einkaufsdaten werden nicht migriert oder gelöscht. Die öffentliche GitHub-Pages-Vorschau bleibt unverändert.

## Weitere Dokumentation

[Architektur](ARCHITECTURE.md) · [Sicherheit](SECURITY.md) · [Deployment](DEPLOYMENT.md) · [Projektregeln](AGENTS.md) · [Änderungen](CHANGELOG.md)

Open Source unter MIT-Lizenz; Lizenz-/Herkunftshinweise der archivierten Lebensmitteldaten bleiben im Archiv erhalten.

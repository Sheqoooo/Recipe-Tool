# Prüfnachweis Cloudflare-Migration

Stand: 9. November 2026. Geprüfter Implementierungscommit: `7b534946b37ef3839f82038274691d87740ffbf8` im Branch `codex/cloudflare-secure-migration`.

[Erfolgreicher CI-Lauf](https://github.com/Sheqoooo/Recipe-Tool/actions/runs/42661603402) · [Pull Request #1](https://github.com/Sheqoooo/Recipe-Tool/pull/1)

| Prüfung | Ergebnis |
| --- | --- |
| Reproduzierbare Installation mit `npm ci` | Erfolgreich |
| Frontend-Build | Erfolgreich |
| TypeScript für Worker und Browser | Erfolgreich |
| Worker-/Geschäftslogik-/JWT-/D1-/API-Tests | 51 erfolgreich |
| Wrangler-Dry-Run mit lokaler Konfiguration | Erfolgreich |
| Wrangler-Dry-Run mit produktiver Konfigurationsvorlage | Erfolgreich; kein Upload/Deployment |
| Versionierte D1-Migration in lokaler Emulation | Erfolgreich |
| Separate lokale Browser-Datenbankmigration | Erfolgreich |
| Playwright Desktop und Mobil | 6 erfolgreich |
| Visuelle Prüfung der CI-Screenshots | Desktop-Import und mobile Einkaufsliste geprüft |

Die Tests prüfen insbesondere: unbekannte Angaben, metrische Normalisierung, keine erfundene Pflichtzutat bei Nicht-Rezepten, schema.org-Extraktion, Host-/DNS-/Redirect-Sperren, striktes Responses-Schema, fehlende/ungültige JWTs, Signatur/Audience/Ablauf, Mitgliedschaften, Besitzer-/Adminrechte, Revisionskonflikte, atomare Rate-/Parallelitäts-/Budgetreservierung, fehlgeschlagene und abgelaufene Importe, veraltete Einkaufs-Häkchen und fail-closed Preview-Isolation.

Die Browserprüfung verwendet ausschließlich den lokalen Fixture-Worker mit gemocktem Quellenabruf und gemockter KI. Tests enthalten keine persönlichen Daten oder echten Schlüssel. Es wurden keine echten OpenAI-Aufrufe ausgeführt.

## Grenzen dieses Nachweises

Die lokale Node-Ausführung auf dem ursprünglichen Rechner blieb auch nach Freigabe durch die Ausführungsumgebung blockiert. Die genannten Befehle liefen deshalb auf dem GitHub-CI-Rechner mit lokalem Workers-/D1-Emulator. Keine Verbindung zu einer produktiven D1 war erforderlich.

Noch nicht live geprüft: tatsächlicher Cloudflare-Account, bestehende produktive D1, Access-Richtlinien auf den echten Domains, echte OpenAI-Verbindung und Verarbeitung realer Webseiten mit dem tatsächlichen Modell. Diese Schritte benötigen die noch fehlenden Konfigurationswerte und die ausdrücklichen jeweiligen Freigaben.

Der `main`-Commit war bei Übergabe unverändert `a1dcd3929985ae3613358f22ff655fe88064383f`. Die PR-Dateiliste enthält keine Änderungen an `index.html`, `.nojekyll` oder `static/`; die bestehende öffentliche Pages-Vorschau ist erhalten. Es wurden keine produktiven Cloudflare-Ressourcen angelegt oder verändert, keine Remote-Migrationen und keine Deployments ausgeführt.

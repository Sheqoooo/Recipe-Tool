# Cloudflare-Einrichtung und Übergabe

Diese Schritte sind für den Betreiber vorbereitet. In diesem Auftrag werden keine produktiven Ressourcen angelegt, keine Migrationen remote angewendet und keine App veröffentlicht. GitHub Pages bleibt bestehen.

## 1. Lokale Entwicklung

Node.js 24 und npm verwenden:

```sh
npm ci
npm run build
npm run db:migrate:local
npm run dev
```

Adresse: `http://127.0.0.1:8787`. `wrangler.jsonc` bindet nur eine lokale D1-Emulation mit `remote:false`. Keine Cloudflare-Anmeldung erforderlich. Nicht `--remote` verwenden. Lokal wird eine ausdrücklich lokale Test-Adminidentität verwendet; keine öffentlich nutzbare Anmeldung. Für einen ausdrücklich freigegebenen echten Test kann der Betreiber `.dev.vars.example` nach `.dev.vars` kopieren und dort selbst einen eigenen Key hinterlegen. Ohne Key funktionieren Sammlung und UI, aber kein KI-Import.

## 2. Bereits angelegte D1 finden

Im Cloudflare-Dashboard **Workers & Pages → D1 SQL Database → die bereits vorhandene Datenbank** öffnen. Auf der Übersichtsseite stehen der **Datenbankname** und die **Database ID** (UUID). Falls die Navigation anders angeordnet ist, nach „D1“ suchen. Beide Werte sind Ressourcenkennungen, keine API-Schlüssel.

Diese Werte in `wrangler.production.jsonc` unter `d1_databases[0].database_name` und `database_id` eintragen. Bindingname bleibt **`DB`**. **Keine zweite produktive Datenbank erstellen.** Die lokale und die Browser-Test-ID sind Platzhalter für lokale Emulation, keine produktiven Ressourcen.

Vor Anwendung der Migration prüfen, ob die vorhandene D1 leer ist oder bereits Tabellen/Daten enthält. Die SQL-Datei setzt kein bestehendes Anwendungsschema zurück; Namenskonflikte müssen vorab geklärt werden. Keine alte private SQLite-Datei ungeprüft importieren.

## 3. Worker und Domain vorbereiten

Im Dashboard einen Worker für dieses Projekt vorbereiten oder einen dafür vorgesehenen bestehenden Worker auswählen. Den Namen mit `name` in `wrangler.production.jsonc` abgleichen. Der Betreiber führt diese Kontoschritte aus; Codex legt keine Ressourcen eigenständig an.

Eine eigene Domain/Subdomain verwenden, z. B. `https://rezepte.example.de`. Diese in `vars.APP_ORIGIN` eintragen. Worker und Static Assets werden gemeinsam unter dieser Origin betrieben. Keine Route nur für `/api` schützen. `workers_dev:false`, `preview_urls:false` und `assets.run_worker_first:true` beibehalten.

## 4. Cloudflare Access

In **Zero Trust → Access → Applications** eine **Self-hosted Application** für die vollständige App-Domain inklusive aller Pfade anlegen. Eine Allow-Richtlinie mit den tatsächlich eingeladenen E-Mail-Adressen bzw. einer kontrollierten Gruppe verwenden. Keine Bypass-/Everyone-Richtlinie für die private App. Geeignete Sitzungsdauer einstellen.

- Teamdomain aus den Zero-Trust-Einstellungen als `ACCESS_ISSUER`: `https://DEIN-TEAM.cloudflareaccess.com`.
- Den **Application Audience (AUD) Tag** aus den Einstellungen der Access-Anwendung als `ACCESS_AUD` eintragen.
- Eigene erste Admin-E-Mail in `BOOTSTRAP_ADMIN_EMAILS` eintragen, mehrere mit Komma getrennt. Erst ein gültiges Access-JWT ermöglicht die Aufnahme in D1.
- Rezeptquellen als exakte Hostnamen in `RECIPE_ALLOWED_HOSTS` freigeben, z. B. tatsächlich verwendete Rezeptanbieter samt benötigter `www`-Variante. Keine Wildcards.

Der Worker prüft das JWT zusätzlich selbst und vertraut keinem ungesicherten E-Mail-Header. Bei Static Assets kann `ctx.access` fehlen; deshalb ist die direkte JWT-Verifikation absichtlich Bestandteil des Codes. [Offizielle Besonderheiten](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## 5. OpenAI-Secret

Auf dem Worker unter **Settings → Variables and Secrets → Add → Secret** den Namen **`OPENAI_API_KEY`** mit dem eigenen Schlüssel hinterlegen. Nicht als Plaintext-Variable, nicht in GitHub und nicht im Chat. Alternativ kann der Betreiber selbst folgenden offiziellen Wrangler-Befehl ausführen:

```sh
npx wrangler secret put OPENAI_API_KEY --config wrangler.production.jsonc
```

Dieser Befehl verändert den Worker und wird nicht von Codex ohne Freigabe ausgeführt. Kein Key ist in Build-Schritten oder im Frontend erforderlich. `OPENAI_MODEL` und Preise sind normale Konfiguration; bei Modellwechsel die dazugehörigen Preise aktualisieren. [Secrets-Dokumentation](https://developers.cloudflare.com/workers/configuration/secrets/)

## 6. Migrationen separat freigeben

Versionierte SQL-Dateien liegen in `migrations/`. Lokale Migrationen sind Teil der Prüfung. Produktive Migrationen sind **kein** Build- oder Deploy-Schritt.

Vor einem freigegebenen Remote-Schritt D1-Export/Time Travel prüfen, das tatsächliche bestehende Schema inspizieren und SQL reviewen. Erst danach kann der Betreiber ausdrücklich ausführen:

```sh
CONFIRM_PRODUCTION_MIGRATIONS=1 npm run db:migrate:production
```

Das Skript prüft die Konfiguration und führt ausschließlich dann `wrangler d1 migrations apply DB --remote --config wrangler.production.jsonc` aus. Es erstellt keine Datenbank. Die Bestätigungsvariable nicht dauerhaft in Workers Builds setzen.

## 7. GitHub mit Workers Builds verbinden

Im Dashboard **Worker → Settings → Builds → Connect Git repository** das Repository auswählen. **Production branch: `main`**. Branchschutz und Reviewpflicht auf GitHub einrichten. Änderungen dieses Auftrags liegen ausschließlich in `codex/cloudflare-secure-migration`; sie dürfen erst nach Nutzerprüfung gemergt werden.

Vor Verbinden automatische Produktionsbuilds kontrollieren, damit keine vorhandene unfertige Konfiguration veröffentlicht wird. Die folgenden Einstellungen erst nach Konfiguration und Freigabe aktivieren:

| Einstellung | Wert |
| --- | --- |
| Root directory | Repository-Wurzel |
| Build command | `npm ci && npm run build && npm run typecheck` |
| Production deploy command | `npm run deploy:production` |
| Production build variable | `CONFIRM_PRODUCTION_DEPLOY=1`, erst bei ausdrücklicher Aktivierung des Merge-Deploy-Ablaufs |
| Preview command | `npm run deploy:preview` |

`scripts/release.mjs` verweigert Produktionsaktionen bei Platzhaltern oder einem bekannten Build-Branch ungleich `main`. Die offizielle Integration setzt `WORKERS_CI_BRANCH`. Das Skript ist eine zusätzliche Schranke, kein Ersatz für Branchschutz. GitHub Actions testet ausschließlich und führt kein Deployment aus. [Workers-Builds-Konfiguration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

## 8. Vorschauen sicher isolieren

Wrangler ist auf eine Version mit neuen Workers Previews festgelegt. `wrangler.production.jsonc` enthält einen separaten `previews`-Block mit `APP_ENV=preview`, **ohne D1-Bindung und ohne KI-Secret**. Die Vorschau ist schreibgeschützt und enthält keine echten Rezepte. Ein versehentlich gebundener Key oder eine DB sperrt sie vollständig.

Für die Preview-Domain eine separate Access-Anwendung/Audience konfigurieren und deren AUD unter `previews.vars.ACCESS_AUD` eintragen. Team-Aussteller ebenfalls separat angeben. Auch Preview-URLs müssen durch Access oder die Worker-JWT-Prüfung geschlossen sein. Im Dashboard **Previews Base** keine produktiven Secrets importieren; insbesondere `OPENAI_API_KEY` dort nicht setzen.

Die offiziellen neuen Previews erben D1 nicht automatisch, benötigen aber ausdrücklich sichere eigene Bindings. Dieses Projekt bindet vorsichtshalber gar keine Preview-Datenbank. Eine spätere interaktive Preview mit Test-D1 und eigener Test-KI wäre eine gesonderte Betreiberentscheidung. Keine produktiven Ressourcen dafür wiederverwenden. [Preview-Konfiguration](https://developers.cloudflare.com/workers/previews/configuration/)

## 9. Backups und Wiederherstellung

Cloudflare D1 **Time Travel** und/oder einen privaten SQL-Export verwenden. Der dokumentierte Exportbefehl ist:

```sh
npx wrangler d1 export DB --remote --config wrangler.production.jsonc --output private-backup.sql
```

Exportdateien gehören außerhalb des Repositories; `private-backup.sql` vor Verwendung zusätzlich privat ablegen. `*.sql` ist absichtlich nicht global ignoriert, da Migrationen versioniert werden müssen. SQL-Backups nicht im Projektordner speichern oder committen. Wiederherstellung über D1-Time-Travel bzw. eine vorab geprüfte SQL-Wiederherstellung ist eine produktive Datenänderung und benötigt eigene Freigabe. Secret separat beim Betreiber sichern. Der UI-JSON-Export ersetzt kein vollständiges D1-Backup. [D1-Backups](https://developers.cloudflare.com/d1/reference/time-travel/)

## Fehlerbehebung

- **401:** Access-JWT fehlt/ungültig, Audience/Issuer oder Sitzung prüfen. Kein Identitätsheader als Ersatz.
- **403 NOT_INVITED:** Access ist erfolgreich, aber D1-Mitgliedschaft fehlt oder ist gesperrt. Admin und Access-Richtlinie müssen beide Zugriff erlauben.
- **503:** Access-/D1-Konfiguration, ausstehende lokale/produktive Migration oder `OPENAI_API_KEY` prüfen. Keine Rohfehler/Secrets öffentlich posten.
- **SOURCE_NOT_ALLOWED / SOURCE_PRIVATE:** Exakten Host und Redirect-Ziele prüfen. Interne Ziele nicht freischalten.
- **IMPORT_LIMIT:** Paralleler Import, Anfragekontingent oder reserviertes Tages-/Monatsbudget erreicht. Keine unkontrollierten Wiederholungen starten.
- **TRANSCRIPT_REQUIRED:** YouTube-Link allein ist nicht ausreichend. Rechtmäßig bereitgestelltes Transkript verwenden.
- **GitHub Pages:** Öffentliche statische Vorschau, keine private D1-/OpenAI-Verbindung. Für die echte App die Access-geschützte Worker-Domain verwenden.

Noch vor Veröffentlichung einzutragen: bestehender D1-Name und UUID, Workername, Domain, Access-Teamdomain, produktive AUD, Preview-AUD, Bootstrap-Admin-E-Mail, erlaubte Rezeptdomains und das Secret im eigenen Cloudflare-Dashboard.

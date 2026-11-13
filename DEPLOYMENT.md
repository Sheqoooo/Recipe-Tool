# Cloudflare-Einrichtung und Übergabe

Diese Schritte sind für den Betreiber vorbereitet. Produktive Ressourcen, Migrationen und App-Deployments benötigen jeweils eine ausdrückliche Betreiberfreigabe. Bereits ausgeführte manuelle Schritte sind von noch offenen Prüfungen zu unterscheiden. GitHub Pages bleibt bestehen.

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

Im Cloudflare-Dashboard **Storage & Databases → D1 SQL Database → die bereits vorhandene Datenbank** öffnen. Auf der Übersichtsseite stehen der **Datenbankname** und die **Database ID** (UUID). Falls die Navigation anders angeordnet ist, nach „D1“ suchen. Beide Werte sind Ressourcenkennungen, keine API-Schlüssel.

Diese Werte in `wrangler.production.jsonc` unter `d1_databases[0].database_name` und `database_id` eintragen. Bindingname bleibt **`DB`**. **Keine zweite produktive Datenbank erstellen.** Die lokale und die Browser-Test-ID sind Platzhalter für lokale Emulation, keine produktiven Ressourcen.

Vor Anwendung der Migration prüfen, ob die vorhandene D1 leer ist oder bereits Tabellen/Daten enthält. Die SQL-Datei setzt kein bestehendes Anwendungsschema zurück; Namenskonflikte müssen vorab geklärt werden. Keine alte private SQLite-Datei ungeprüft importieren.

## 3. Kostenlose workers.dev-Adresse vorbereiten

Im Dashboard einen Worker für dieses Projekt vorbereiten oder einen dafür vorgesehenen bestehenden Worker auswählen. Den Namen mit `name` in `wrangler.production.jsonc` abgleichen. Der Betreiber führt diese Kontoschritte aus; Codex legt keine Ressourcen eigenständig an.

Keine eigene Domain und keine DNS-Einträge nötig. Unter **Workers & Pages** steht die Konto-Subdomain bei **Your subdomain**. Der Workername `recipe-tool` ergibt die Adresse `https://recipe-tool.DEINE-SUBDOMAIN.workers.dev`. Die tatsächliche Adresse des Workers kopieren und als `vars.APP_ORIGIN` in der Konfiguration eintragen, ohne abschließenden Schrägstrich. Für dieses Projekt ist bereits `https://recipe-tool.sahin-erengil92.workers.dev` eingetragen. Selbsthoster ersetzen diese Adresse durch ihre eigene.

Frontend und `/api/*` laufen gemeinsam unter dieser Origin. `workers_dev:true`, `preview_urls:false` und `assets.run_worker_first:true` beibehalten. `preview_urls:false` deaktiviert alte Versions-URLs; die neuen Workers Previews sind separat konfiguriert. `scripts/hosting-guard.mjs` prüft den exakten Workerhost, die Asset-Authentifizierung und beide Access-Konfigurationen vor einem Release. Es kann die tatsächliche Dashboard-Richtlinie nicht prüfen. [Offizielle workers.dev-Konfiguration](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## 4. Cloudflare Access

Zuerst Zero Trust im Cloudflare-Konto einrichten, falls noch nicht aktiv. Für die Anmeldung per E-Mail **One-time PIN** als Loginmethode aktivieren (Zero Trust → Integrations → Identity providers → Add new identity provider → One-time PIN). Dadurch sind keine zusätzlichen Benutzerkonten bei einem Identitätsanbieter nötig.

Dann **Workers & Pages → recipe-tool → Access → Protect this Worker behind Access** öffnen. **All traffic** auswählen, ausdrücklich nicht nur **Previews only**. Unter **Authentication policy** eine **Allow**-Richtlinie mit **Include → Emails** erstellen und ausschließlich einzelne freigegebene E-Mail-Adressen eintragen. Keine Freigabe einer gesamten E-Mail-Domain, keine Everyone-/Bypass-Richtlinie. Sitzungsdauer auf höchstens 24 Stunden setzen und **Apply Access** wählen.

Diese Worker-weite Access-Anwendung schützt alle zugehörigen URLs einschließlich `workers.dev`, sämtlicher Pfade, API-Endpunkte und Vorschauen. Nicht die kontoübergreifende Option „Protect all Workers“ verwenden: Andere Projekte und die vorhandene Pages-Seite sollen unverändert bleiben. Access muss vor dem ersten App-Deployment eingerichtet und geprüft werden. Die hier beschriebenen Kontoaktionen führt ausschließlich der Betreiber aus. [Offizieller Dashboard-Ablauf](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

- Teamdomain aus den Zero-Trust-Einstellungen als `ACCESS_ISSUER`: `https://DEIN-TEAM.cloudflareaccess.com`.
- Unter **Zero Trust → Access controls → Applications** die für `recipe-tool` angelegte Anwendung öffnen. Den **Application Audience (AUD) Tag** unter **Configure → Additional settings** als `vars.ACCESS_AUD` und `previews.vars.ACCESS_AUD` eintragen. Beide Umgebungen verwenden dieselbe Worker-weite Access-Anwendung; der Aussteller muss ebenfalls in beiden Blöcken stehen.
- Eigene erste Admin-E-Mail als **Worker Secret `BOOTSTRAP_ADMIN_EMAILS` nur für Production** hinterlegen, mehrere mit Komma getrennt. Nicht unter `vars` oder im öffentlichen Repository eintragen. Erst ein gültiges Access-JWT ermöglicht die Aufnahme in D1. Fehlt das Secret, wird kein erster Administrator automatisch angelegt.
- `RECIPE_ALLOWED_HOSTS` leer lassen: Öffentliche HTTPS-Rezeptseiten benötigen keine einzelne Freigabe. Optional schränkt eine kommaseparierte Liste exakter Hostnamen die Quellen zusätzlich ein. `global_fetch_strictly_public` beibehalten und keine privaten Netzwerk-/Service-Bindings hinzufügen.

Der Worker prüft das JWT zusätzlich selbst und vertraut keinem ungesicherten E-Mail-Header. Bei Static Assets kann `ctx.access` fehlen; deshalb ist die direkte JWT-Verifikation absichtlich Bestandteil des Codes. [Offizielle Besonderheiten](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## 5. OpenAI-Secret

Auf dem Worker unter **Settings → Variables and Secrets → Add → Secret** den Namen **`OPENAI_API_KEY`** mit dem eigenen Schlüssel hinterlegen. Nicht als Plaintext-Variable, nicht in GitHub und nicht im Chat. Alternativ kann der Betreiber selbst folgenden offiziellen Wrangler-Befehl ausführen:

```sh
npx wrangler secret put OPENAI_API_KEY --config wrangler.production.jsonc
```

Zusätzlich `BOOTSTRAP_ADMIN_EMAILS` auf demselben Weg als Production-Secret speichern. Beide Secrets bleiben im Worker und werden durch normale Wrangler-Code-Deployments beibehalten; niemals ihren Inhalt ins Build-System kopieren. Dieser Befehl verändert den Worker und wird nicht von Codex ohne Freigabe ausgeführt. Kein Key ist in Build-Schritten oder im Frontend erforderlich. `OPENAI_MODEL` und Preise sind normale Konfiguration; bei Modellwechsel die dazugehörigen Preise aktualisieren. [Secrets-Dokumentation](https://developers.cloudflare.com/workers/configuration/secrets/)

## 6. Migrationen separat freigeben

Versionierte SQL-Dateien liegen in `migrations/`: `0001_shared_cookbook.sql` für sieben Anwendungstabellen, `0002_recipe_listing_index.sql` für den Listenindex. Beide gehören zum initialen Stand; bei bereits angewendetem 0001 nur ausstehende Migrationen über Wrangler anwenden. Lokale Migrationen sind Teil der Prüfung. Produktive Migrationen sind **kein** Build- oder Deploy-Schritt.

Vor einem freigegebenen Remote-Schritt D1-Export/Time Travel prüfen, das tatsächliche bestehende Schema inspizieren und SQL reviewen. Erst danach kann der Betreiber ausdrücklich ausführen:

```sh
CONFIRM_PRODUCTION_MIGRATIONS=1 npm run db:migrate:production
```

Das Skript prüft die Konfiguration und führt ausschließlich dann `wrangler d1 migrations apply DB --remote --config wrangler.production.jsonc` aus. Es erstellt keine Datenbank. Die Bestätigungsvariable nicht dauerhaft in Workers Builds setzen.

## 7. GitHub mit Workers Builds verbinden

Im Dashboard **Worker → Settings → Builds → Connect Git repository** das Repository auswählen. **Production branch: `main`**. Branchschutz und Reviewpflicht auf GitHub einrichten. Änderungen werden in `codex/`-Branches vorbereitet und erst nach Nutzerprüfung und ausdrücklicher Merge-Freigabe übernommen.

Vor Verbinden automatische Produktionsbuilds kontrollieren, damit keine vorhandene unfertige Konfiguration veröffentlicht wird. Die folgenden Einstellungen erst nach Konfiguration und Freigabe aktivieren:

| Einstellung | Wert |
| --- | --- |
| Root directory | Repository-Wurzel |
| Build command | `npm ci && npm run build && npm run typecheck` |
| Production deploy command | `CONFIRM_PRODUCTION_DEPLOY=1 npm run deploy:production`, erst nach ausdrücklicher Aktivierung des Merge-Deploy-Ablaufs |
| Alternative zum vorangestellten Freigabewert | Build-Variable `CONFIRM_PRODUCTION_DEPLOY=1` und Deploy-Befehl `npm run deploy:production`; nicht als Worker-Laufzeitvariable setzen |
| Preview command | `npm run deploy:preview` |

`scripts/release.mjs` verweigert Produktionsaktionen bei Platzhaltern oder einem bekannten Build-Branch ungleich `main`. Die offizielle Integration setzt `WORKERS_CI_BRANCH`. Das Skript ist eine zusätzliche Schranke, kein Ersatz für Branchschutz. GitHub Actions testet ausschließlich und führt kein Deployment aus. [Workers-Builds-Konfiguration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

## 8. Vorschauen sicher isolieren

Wrangler ist auf eine Version mit neuen Workers Previews festgelegt. `wrangler.production.jsonc` enthält einen separaten `previews`-Block mit `APP_ENV=preview`, **ohne D1-Bindung und ohne KI-Secret**. Die Vorschau ist schreibgeschützt und enthält keine echten Rezepte. Ein versehentlich gebundener Key oder eine DB sperrt sie vollständig.

Die in Schritt 4 eingerichtete Worker-weite Access-Anwendung muss auf **All traffic** stehen und schützt damit auch neue Preview-URLs. Deren Audience und Team-Aussteller ausdrücklich im `previews.vars`-Block eintragen; sie werden dort nicht automatisch aus `vars` übernommen. Im Dashboard **Previews Base** keine produktiven Secrets importieren; insbesondere `OPENAI_API_KEY` und `BOOTSTRAP_ADMIN_EMAILS` dort nicht setzen. Die Preview hat keine D1 und ist schreibgeschützt; dies ist zusätzlich zum Access-Schutz eine Isolation der Ressourcen.

Vor Aktivierung automatischer Builds in einem privaten Browserfenster die Hauptadresse, `/api/state`, eine Asset-Adresse wie `/app.js` sowie eine vorhandene Preview-Adresse öffnen: Ohne Anmeldung muss Access zur Anmeldung führen oder blockieren. Eine nicht erlaubte E-Mail darf auch nach PIN-Eingabe nicht zugreifen. Eine freigegebene E-Mail darf die Preview öffnen, aber keine Importe starten. Diese Live-Prüfungen sind noch nicht durchgeführt; es gibt keinen freigegebenen Deploy in diesem Auftrag.

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
- **SOURCE_NOT_ALLOWED / SOURCE_PRIVATE:** Eine optional gesetzte Hostbeschränkung bzw. DNS-/Redirect-Ziele prüfen. Bei leerer Hostliste sind öffentliche Anbieter zugelassen. Interne Ziele nicht freischalten.
- **AI_CREDITS_EMPTY / AI_QUOTA / AI_SPEND_LIMIT / AI_USAGE_LIMIT:** OpenAI meldet fehlendes Guthaben, ein Kontingent- oder Ausgabenlimit. Das verwendete API-Projekt bzw. die Organisation in der OpenAI-API-Abrechnung prüfen. ChatGPT Plus ist getrennt. Nicht blind wiederholt importieren oder ohne Prüfung Limits erhöhen; kein neuer API-Key erforderlich, solange dieser gültig ist.
- **AI_RATE_LIMIT:** Kurzfristiges OpenAI-Anfragelimit; später erneut versuchen und bei Wiederholung API-Anfragelimits prüfen. **AI_LIMIT:** Nicht genauer klassifiziertes Anbieterlimit; Abrechnung und Anfragelimits prüfen. Die rohe Anbieterantwort wird nicht ausgegeben.
- **IMPORT_LIMIT:** Paralleler Import, Anfragekontingent oder reserviertes Tages-/Monatsbudget erreicht. Keine unkontrollierten Wiederholungen starten.
- **VIDEO_SOURCE_REQUIRED:** Der Plattformlink liefert keinen ausreichenden zugänglichen Rezepttext. Optional eine rechtmäßig bereitgestellte Beschreibung oder ein Transkript verwenden.
- **GitHub Pages:** Öffentliche statische Vorschau, keine private D1-/OpenAI-Verbindung. Für die echte App die Access-geschützte Worker-Domain verwenden.

Die bestehende D1 `recipe-prod` / `58577ba1-de20-4078-915d-9c0a2962f555` ist bereits eingetragen. Worker-Adresse, Access-Teamdomain und Worker-AUD sind ebenfalls eingetragen. Der Betreiber hat die Secrets `OPENAI_API_KEY` und `BOOTSTRAP_ADMIN_EMAILS` nach eigener Angabe ausschließlich für Production hinterlegt; ihre Werte wurden nicht ausgelesen. Vor Veröffentlichung bleiben die getrennt freizugebende Migration und die GitHub-/Build-Einrichtung sowie die Live-Prüfung der tatsächlichen App. Keine eigene Domain erforderlich. GitHub-Verbindung und automatische Deployments erst nach Review, Access-Einrichtung und ausdrücklicher Aktivierung freischalten; das Verbinden kann bereits einen Build auslösen.

## Smoke-Test nach Freigabe

Vor Nutzung die [konkrete manuelle Checkliste](docs/SMOKE-TEST.md) abarbeiten und Ergebnisse protokollieren. Access vor Assets/API und Preview, D1-Migrationsstand, Rollen, Quellen-/URL-Grenzen und Persistenz prüfen. Echte OpenAI-Imports benötigen eine ausdrückliche separate Kostenfreigabe. Die Checkliste ist noch nicht live durchgeführt; der funktionierende Hello-World-Login beweist nicht die vollständige App-Integration.

## Einrichtung ausschließlich im Dashboard

Der bestehende Worker kann mit GitHub verbunden werden; hierfür ist kein lokales Terminal nötig. Die Verbindung verwaltet Builds, nicht die D1-Migrationen. Beim Einrichten Builds zunächst deaktivieren und nach abgeschlossener Konfiguration gezielt aktivieren.

### D1 manuell initialisieren

Nur nach ausdrücklicher Freigabe und Prüfung der bestehenden Datenbank: In **D1 → recipe-prod → Console** den Tabellen-/Indexbestand über `sqlite_schema` lesen. Bei leerem Anwendungsschema die geprüften SQL-Anweisungen aus `migrations/0001_shared_cookbook.sql` und anschließend `0002_recipe_listing_index.sql` ausführen. Keine Tabellen zurücksetzen. **Kommentarzeilen beginnend mit `--` nicht zusammen mit durch die Konsole zu einer Zeile verbundenem SQL einfügen:** Sonst kann der Rest des Blocks auskommentiert werden. Bei Fehlern den Bestand erneut lesen, statt den kompletten Block blind zu wiederholen.

Wranglers Migrationstabelle hat das folgende offizielle Format. Nur anlegen, falls noch nicht vorhanden:

```sql
CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

Erst nach Prüfung aller sieben Anwendungstabellen samt Quell-/Importindizes und des Index `recipes_listing` beide Dateien als angewendet erfassen:

```sql
INSERT OR IGNORE INTO d1_migrations (name)
VALUES ('0001_shared_cookbook.sql'), ('0002_recipe_listing_index.sql');
SELECT name FROM d1_migrations ORDER BY id;
```

Damit bleibt der dokumentierte Versionsstand auch bei späterer Verwendung von Wrangler konsistent. Nie eine fehlgeschlagene oder nur teilweise angewendete Migration als erledigt markieren. [D1-Migrationen](https://developers.cloudflare.com/d1/reference/migrations/), [Wrangler-Tabellenschema](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/d1/migrations/helpers.ts)

### Ersten Git-Build auslösen

Der dokumentierte Git-Workflow startet einen Build durch einen neuen Push auf den verbundenen Branch. Ein bereits vor der Verbindung vorhandener Merge wird nicht zwangsläufig nachträglich gebaut. Das Speichern einer Build-Konfiguration wird für den nächsten Build wirksam und ist kein verlässlicher Build-Auslöser. Falls ein fehlgeschlagener Git-Build existiert, kann dieser nach Korrektur erneut gestartet werden. Falls nicht, erfolgt der erste produktive Build beim nächsten **ausdrücklich freigegebenen PR-Merge auf main**. Kein Direkt-Push und kein Umgehen des Release-Skripts nötig.

Im Deploy-Befehl stellt `CONFIRM_PRODUCTION_DEPLOY=1 npm run deploy:production` den vom Skript geforderten Freigabewert für diesen Prozess bereit; dafür ist kein zusätzlicher Eintrag unter Laufzeit-Secrets erforderlich. Der API-Key gehört weiterhin ausschließlich in Production Worker Secrets. [Git-Build-Ablauf](https://developers.cloudflare.com/workers/ci-cd/builds/), [Build-Konfiguration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

### Manuell beobachteter Stand am 9. November 2026

Nach Angaben und Screenshots des Betreibers: Access-All-traffic mit E-Mail-Allow-Regel und One-time PIN funktioniert am Hello-World-Platzhalter; Production-Secrets und D1-Binding sind angelegt; sieben Anwendungstabellen, der ergänzte Listenindex und beide Migrationseinträge wurden eingerichtet bzw. vom Betreiber als erfolgreich bestätigt. GitHub ist mit main verbunden und der Deploy-Befehl wurde inklusive Freigabewert hinterlegt. Auf der gezeigten Deployment-Seite war weiterhin nur der Platzhalter aktiv. **Die eigentliche App und die vollständige Smoke-Test-Checkliste sind noch nicht live verifiziert.** Keine echten KI-Anfragen wurden durch Codex ausgeführt.

OpenAI kann sowohl vorübergehende Anfragelimits als auch Guthaben-/Ausgaben-/Kontingentprobleme mit HTTP 429 melden. Die App unterscheidet bekannte Anbieter-Codes, statt pauschal zum späteren Wiederholen aufzufordern. Eine reine Bildschirmmeldung der älteren Version beweist deshalb noch keinen konkreten Abrechnungsgrund. [Offizielle Fehlerzuordnung](https://help.openai.com/en/articles/5955604-troubleshooting-api-rate-limits-and-429-errors)

### Vor Veröffentlichung der Bildfunktion
Migration `migrations/0003_recipe_images.sql` ist erforderlich. Sie legt ausschließlich `recipe_images` in der vorhandenen Datenbank an. Vorher Backup und explizite Freigabe; nicht automatisch während Build/Deploy ausführen. Standardmäßig nur lokal mit `npm run db:migrate:local` prüfen. Ohne Migration kann die neue Sammlung nicht geladen werden. Bestehende Rezepte werden nicht automatisch neu abgerufen. JSON-Export enthält Bildmetadaten, keine Bildbytes; vollständige Sicherung erfolgt mit D1 einschließlich BLOBs.

### Vor Veröffentlichung der Einkaufskacheln
Zusätzlich zu Migration 0003 benötigt dieser Stand `migrations/0004_shopping_items.sql`. Vorher Backup prüfen und Remote-Migration ausdrücklich freigeben; sie läuft niemals automatisch im Build oder Deployment. Die neue Tabelle wird in der bestehenden D1 angelegt. Lokal: `npm run db:migrate:local`. Weitere Secrets, API-Kosten oder Dienste sind für Autovervollständigung und Emojis nicht erforderlich. Ohne Migration 0004 kann der neue `/api/state` nicht vollständig geladen werden. Datenbankbackup enthält Einkaufseinträge; der bestehende Rezept-JSON-Export bleibt auf Rezepte beschränkt.

### Weitere Voraussetzung: Zutatenübernahme und iOS
Vor Veröffentlichung auch `0005_shopping_batch_limit.sql` nach Backup und ausdrücklicher Freigabe anwenden. Kein automatischer Build-/Deploy-Migrationsschritt. Der Trigger ergänzt das vorhandene Limit für atomare Zutaten-Batches; keine weitere Datenbank.

Build generiert die beiden Installationsseiten, Manifeste und PNG-Symbole automatisch. Keine zusätzlichen Secrets und kein Icon-Dienst. Alle Pfade bleiben hinter Access. Nach Freigabe auf einem echten iPhone mit Safari sowohl `/recipes/` als auch `/shopping/` öffnen und getrennt zum Home-Bildschirm hinzufügen. Namen, Icons, Direktstart, erneute Access-Anmeldung und Rückwechsel testen. Diese Geräteprüfung kann nicht durch Chromium-Tests ersetzt werden. Aktuelle Live-Version bleibt bis zur Freigabe unverändert.

### Freigabestand für Veröffentlichung
Der Nutzer hat Import und Veröffentlichung beauftragt. Der Produktkatalog wird mit dem Build ausgeliefert und benötigt keinen D1-Import. Vor dem Zusammenführen/Deploy müssen die produktiven Schemastände 0003–0005 nach Backup geprüft und gegebenenfalls angewendet werden. Diese Schritte bleiben separat; der Deploymentbefehl führt sie nicht aus. Codex besitzt in dieser Umgebung keinen nutzbaren Cloudflare-Accountzugriff. Solange die Migrationen nicht bestätigt sind, nicht in einen fehlerhaften Produktivstand deployen. Die vorbereiteten Migrationen enthalten keine DROP-/DELETE-Anweisungen gegen bestehende Rezepte.

### Mobile Einkaufsleiste / gefüllte Tüte
Diese Änderung benötigt keine D1-Migration und keine neuen Secrets. PNGs und der dunkle Installations-Einstieg werden im Build erzeugt; alle Assets bleiben hinter Access. Nach Freigabe automatisch über den bestehenden GitHub-/Cloudflare-Prozess veröffentlichen. Im iOS-Smoke-Test Leiste bei Scrollen und eingeblendeter Tastatur sowie Home-Symbol nach erneutem Hinzufügen prüfen. Alte installierte Icons werden eventuell von iOS zwischengespeichert.

## Kurzvideo-Links

Keine zusätzliche Ressource, D1-Migration, Plattform-Zugangsdaten, Audio-Key-Berechtigung oder Tarifumstellung nötig. Öffentliches HTML wird nach bestehenden Sicherheitsregeln versucht. Der vorhandene OpenAI-Key mit Responses-Schreibrecht genügt. Sol bleibt aktiv; Terra/Mini Transcribe sind nur eine dokumentierte Empfehlung für einen möglichen späteren automatischen Medienadapter. Video-Uploads wurden auf Nutzerwunsch gestrichen.

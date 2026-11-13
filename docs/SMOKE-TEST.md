# Manueller Smoke-Test nach Freigabe

Status: **noch nicht durchgeführt**. Die erfolgreichen lokalen Emulator-/Mocktests ersetzen diese Prüfung im tatsächlichen Cloudflare-Konto nicht. Automatischer YouTube-Videoimport bleibt das langfristige Produktziel; der aktuelle Transkriptimport ist ein eingeschränkter Zwischenstand.

## Freigaben und Protokoll

Vor Beginn getrennt festhalten: freigegebener Commit, App-Deployment, anzuwendende SQL-Migrationen und gegebenenfalls kostenpflichtige OpenAI-Importtests. Eine Merge-Freigabe ist nicht automatisch eine Freigabe für Datenänderungen oder echte KI-Anfragen. Keine produktiven Fehlerszenarien durch Austauschen von Secrets oder absichtliches Überlasten erzeugen.

| Feld | Eintrag |
| --- | --- |
| Datum / prüfende Person | offen |
| Commit / Deployment-Version | offen |
| Hauptadresse / geschützte Preview-Adresse | offen |
| Access-/D1-/Deploy-Freigabe | offen |
| Freigabe echte KI-Aufrufe, maximale Anzahl / Kosten | offen |
| Ergebnis / offene Fehler | offen |

Als Rollen werden ein Administrator, ein zusätzlich eingeladenes normales Mitglied und eine nicht erlaubte Testidentität benötigt. E-Mail-Adressen bleiben privat. Nur vereinbarte Testrezepte verwenden, keine fremden privaten Rezepte ändern. Ergebnisse mit Fehlercode und Testnummer protokollieren; keine Keys, Cookies, JWTs oder vollständigen Netzwerkexporte veröffentlichen.

## 1. Access und Preview — noch kein KI-Aufruf

- [ ] Im Worker **Access** prüfen: **All traffic**, ausschließlich die beabsichtigte E-Mail-Allow-Regel, höchstens 24 Stunden Sitzung. Keine zusätzliche Cloudflare-account-/Everyone-/Bypass-Regel, die weitere Personen zulässt.
- [ ] In einem frischen privaten Browserfenster nacheinander `/`, `/app.js`, `/style.css`, `/api/state` der Hauptadresse aufrufen. Erwartung: Access-Anmeldung oder Sperre, keine App-Dateien und keine privaten API-Daten vor Anmeldung.
- [ ] Mit nicht erlaubter E-Mail versuchen: kein Zugang. Mit erlaubter E-Mail per One-time PIN anmelden: Zugriff möglich. Access-Login allein genügt ohne aktive App-Mitgliedschaft weiterhin nicht.
- [ ] Als Admin Sammlung öffnen. Als Mitglied ohne Einladung bzw. nach ausdrücklich freigegebener Sperrung in der Mitgliederverwaltung: `403 NOT_INVITED`; keine Rezepte. Für den Sperrtest ausschließlich die Testidentität verwenden, nicht den letzten Administrator.
- [ ] Dasselbe für eine tatsächlich erstellte Preview testen: Anmeldung erforderlich, anschließend leere schreibgeschützte Sammlung. Import und andere POST-Aktionen sind gesperrt. Ohne vorhandene Preview diesen Punkt als **offen** kennzeichnen, nicht als bestanden.
- [ ] Preview-Konfiguration im Dashboard kontrollieren: keine D1, kein `OPENAI_API_KEY`, kein `BOOTSTRAP_ADMIN_EMAILS`; keine Produktions-Secrets aus Previews Base importiert. Alte Versions-URLs bleiben deaktiviert.

## 2. Bestehende D1 und Migrationen

- [ ] Binding `DB` zeigt ausschließlich in Production auf `recipe-prod`, ID `58577ba1-de20-4078-915d-9c0a2962f555`. Keine zweite produktive Datenbank.
- [ ] Vor Remote-Migration Bestand und Backup-/Wiederherstellungsmöglichkeit prüfen. Beide SQL-Dateien reviewen: `0001_shared_cookbook.sql` erstellt sieben Anwendungstabellen; `0002_recipe_listing_index.sql` ergänzt nur den Listenindex. Freigabe und Anwendung separat vom Deployment protokollieren. Der dokumentierte Betreiberbefehl steht in DEPLOYMENT.md; ihn nicht als Build-Schritt hinterlegen.
- [ ] Nach Migration in der D1-Konsole nur lesend prüfen:

```sql
SELECT name FROM sqlite_schema
WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;
SELECT name FROM sqlite_schema
WHERE type='index' AND name='recipes_listing';
```

Erwartete Anwendungstabellen: `members`, `recipes`, `ingredients`, `steps`, `plan`, `checked_items`, `imports`. Wrangler-interne Migrationstabellen können zusätzlich vorhanden sein. Der Index `recipes_listing` muss vorhanden sein.

- [ ] Nach erster Adminanmeldung aktive Mitgliedschaft/Rolle kontrollieren. Keine Admin-Adresse in öffentlichen Repository-Variablen oder im Browser-Bundle.
- [ ] Nach einem freigegebenen Testimport Seite neu laden und neu anmelden: Rezept bleibt gespeichert; Zutaten/Schritte sind vollständig und korrekt zugeordnet. Kopieren/Exportieren der Sammlung gibt keine vollständigen Rohquellen aus.

## 3. Sensible Links und Fehlergrenzen — kein kostenpflichtiger Test nötig

- [ ] In der App `https://example.com/?access_token=SMOKE_TEST_NOT_A_SECRET` eingeben, anschließend mit `apikey` bzw. `X-Amz-Signature` statt `access_token`. Erwartung: `PRIVATE_URL`, kein Rezept, kein neuer Importdatensatz, kein KI-Verbrauch. Der Fehler enthält weder URL noch Parameterwert.
- [ ] `https://127.0.0.1/` und `https://host.internal/` eingeben: kontrollierte Ablehnung; kein Rezept. Quellprüfungen nach einer Kostenreservierung können einen fehlgeschlagenen Importversuch zählen, aber keine KI-Anfrage auslösen.
- [ ] Bei einem vereinbarten nicht auslesbaren Rezeptlink: verständlicher Fehler statt Rohfehler/Stacktrace; kein leerer Rezeptdatensatz. Keine Zugangsdaten in die Quelle eingeben.
- [ ] Historische verdächtige Quell-URLs nur bei bestehendem Anlass und mit eigener Freigabe untersuchen. Neue Daten werden geprüft; alte unsichere URLs werden in Sammlung/Historie als leere Quelle ausgegeben. Dieses Verhalten löscht vorhandene DB-Werte nicht. Nicht absichtlich echte Geheimnisse als Testdaten eintragen.

## 4. OpenAI und Webseitenimport — erst nach ausdrücklicher Kostenfreigabe

- [ ] Produktions-Key und Admin-Adresse ausschließlich als Worker Secrets hinterlegt, Schlüsselberechtigung für Responses vorhanden, Modell und Preise konfiguriert, API-Abrechnung aktiv. App-Kontingente vor Testbeginn ablesen/vereinbaren.
- [ ] Eine öffentlich lesbare Rezeptquelle mit überprüfbaren Zutaten/Mengen/Zeiten auswählen. URL im privaten Testprotokoll notieren. Nach Freigabe **genau einen** Import starten.
- [ ] Erwartung: automatische Speicherung ohne obligatorische Korrekturmaske; deutscher Titel und Schritte; Quelle korrekt; bekannte Zeiten/Portionen erhalten; unbekannte Angaben als unbekannt/Hinweis. Zutatenmengen zusätzlich in den passenden Schritten, unklare Teilmengen nicht erfunden.
- [ ] Für eine US-Quelle anhand des Originals oz/lb, Fahrenheit und Cups nachprüfen. Bei Cups zu Gramm muss die Zutat berücksichtigt oder Volumen beibehalten werden. Dieser zusätzliche Import benötigt ein eigenes Kontingent im Testprotokoll.
- [ ] Eine lange Seite mit großem JSON-LD (Bewertungen/Bilder) bzw. langer Einleitung und kurzer Rezeptkarte nach Freigabe testen: der Rezeptkern soll importiert werden. Wenn der eigentliche Zutaten-/Schritttext selbst über 20 KB bleibt oder nicht verlässlich isolierbar ist, kontrolliertes `SOURCE_TOO_LARGE` statt still gekürztem Rezept erwarten.
- [ ] In D1 nur lesend die letzten Importmetadaten prüfen:

```sql
SELECT status, error_code, input_tokens, output_tokens,
       estimated_cost_microusd, model
FROM imports ORDER BY created_at DESC LIMIT 5;
```

Erwartung bei Erfolg: `completed`, Tokenverbrauch und Kostenschätzung vorhanden. Mit dem privaten OpenAI-Verbrauchs-Dashboard zeitversetzt abgleichen. Keine Produktions-Keys in Logs oder Browser-Netzwerkanfragen.

- [ ] Identischen Link erneut importieren (auch anderes URL-Fragment): vorhandenes Rezept wird wiedererkannt, kein weiterer KI-Aufruf. Reguläre Rezept-Query-Parameter bleiben bei der Wiedererkennung erhalten.
- [ ] Rezept zur Kochliste hinzufügen, Portionen ändern, Einkaufsmengen prüfen, Position abhaken und neu laden. Nach Mengenänderung dürfen alte Häkchen nicht unpassend erhalten bleiben.
- [ ] Als normales Mitglied eigenes Testrezept bearbeiten; fremdes Rezept und Löschen bleiben gesperrt. Als Admin darf das vereinbarte Testrezept verwaltet werden. Löschen nur nach Freigabe des konkreten Testdatensatzes.

Timeouts, OpenAI-429/5xx und unvollständige Modellantworten sind mit Mocks automatisiert abgedeckt. Sie werden für diesen Smoke-Test nicht kostenpflichtig oder durch absichtliche Produktionsstörungen erzwungen.

## 5. Eingeschränkter YouTube-Zwischenstand

- [ ] YouTube-Shorts-/Instagram-/TikTok-Link ohne Transkript: öffentliche Beschreibung wird versucht; bei fehlendem Rezepttext `VIDEO_SOURCE_REQUIRED`. Keine Plattform-Anmeldung oder Video-Downloads.
- [ ] Optional und nur nach Kostenfreigabe: rechtmäßig bereitgestelltes Transkript bis 20 KB, Nutzungsbestätigung und angegebene Videodauer bis 20 Minuten importieren. Erwartung: Hinweis, dass ausschließlich Text und keine Bilder/Audio analysiert wurden. Die angegebene Dauer wird nicht am Video verifiziert.
- [ ] Festhalten: **Vollständige automatische Ton-/Bildanalyse beliebiger Plattformlinks ist nicht implementiert.** Dieses Produktziel ist durch das Bestehen des Transkript-Tests nicht erreicht.

Abschluss: Jeden Punkt als bestanden, fehlgeschlagen oder offen markieren. Ein fehlgeschlagener Schutztest blockiert die weitere Nutzung der privaten App bis zur Behebung. Keine offenen Live-Prüfungen als erfolgreich ausgeführt darstellen.

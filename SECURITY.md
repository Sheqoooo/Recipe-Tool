# Sicherheit

## Verbindliche Betriebsgrenzen

Die Anwendung ist ein privates gemeinsames Kochbuch. Vor einer Veröffentlichung müssen Access, die bestehende D1-Datenbank, Admins, Quellenfreigaben und Worker Secrets konfiguriert werden. Die mitgelieferten produktiven Platzhalter sind absichtlich nicht veröffentlichungsfähig. Es gibt weder automatische Produktionsmigrationen noch ein Deployment aus GitHub Actions.

## Authentifizierung und Rechte

Cloudflare Access schützt den gesamten Worker mit der Einstellung **All traffic**, einschließlich seiner kostenlosen `workers.dev`-Adresse, aller Pfade/API-Endpunkte und neuer Workers Previews. Eine Allow-Richtlinie enthält ausschließlich ausdrücklich freigegebene einzelne E-Mail-Adressen. Zusätzlich prüft der Worker jedes `Cf-Access-Jwt-Assertion` kryptografisch, einschließlich Aussteller, Audience und höchstens 24 Stunden Tokenalter. Access-Sitzungen entsprechend auf maximal 24 Stunden konfigurieren. Ungeschützte alternative Hosts dürfen nicht eingerichtet werden; `workers_dev:true` ist der vorgesehene primäre Zugang, alte Versions-URLs bleiben mit `preview_urls:false` deaktiviert. Alle Static Assets laufen zuerst durch den Worker. Direkte Identitätsheader werden nicht verwendet. Access-Aussteller müssen eine feste `*.cloudflareaccess.com`-Teamadresse sein; sie kommen nie aus dem Request.

Das JWT reicht allein nicht: E-Mail und Subject werden an eine aktive D1-Mitgliedschaft gebunden. Nicht eingeladene oder gesperrte Nutzer erhalten keinen Zugang. Initiale Admins werden ausschließlich aus `BOOTSTRAP_ADMIN_EMAILS` nach erfolgreicher JWT-Prüfung aufgenommen. Eine nachträglich geänderte Bootstrap-Liste befördert keine vorhandenen Mitglieder automatisch.

Mitglieder bearbeiten nur eigene Rezepte. Admins dürfen alle bearbeiten/löschen und Mitglieder verwalten. Der API-Endpunkt prüft dies unabhängig vom Frontend. Eigene Rolle/Aktivierung kann ein Admin nicht selbst ändern. Access-seitiges Entfernen allein kann noch laufende Tokens hinterlassen; für sofortigen App-Ausschluss zusätzlich die D1-Mitgliedschaft sperren.

## Lokale Entwicklung und Vorschauen

Lokale Testidentität ist nur bei `APP_ENV=local`, `AUTH_MODE=local` **und Loopback-URL** zulässig. Sie ist keine Produktionsanmeldung. Nicht mit einem öffentlichen Tunnel oder `--remote` betreiben. Standardlokalentwicklung verwendet ausschließlich lokal emuliertes D1.

Neue Workers Previews sind gesondert konfiguriert: die Audience der Worker-weiten Access-Anwendung auch für Vorschauen, keine D1-Bindung und kein OpenAI-Secret. Der Worker verweigert die Vorschau vollständig, wenn dort dennoch DB oder Key gebunden sind. Schreibzugriffe sind gesperrt. Keine produktiven Secrets in „Previews Base“ importieren. Bei fehlender Access-Konfiguration schlägt die Vorschau geschlossen fehl. GitHub Pages enthält nur den unveränderten öffentlichen UI-Prototyp und hat keine private Worker-Verbindung.

## Secrets und Datenschutz

`OPENAI_API_KEY` ausschließlich als Cloudflare Worker Secret hinterlegen. Die aktive Oberfläche hat kein Key-Formular; es existiert kein Endpunkt zum Speichern eines Keys. Lokal ist eine ignorierte `.dev.vars` möglich. Schlüssel, `.env*`, `.dev.vars*`, D1-Kopien und Laufzeitdateien sind ausgeschlossen. Beispiele enthalten nur Platzhalter. Die öffentlichen Pages-Dateien enthalten keinen echten Schlüssel.

OpenAI erhält ausschließlich den begrenzten für die Analyse nötigen Quelltext, keine Nutzer-E-Mail. `store:false` ist gesetzt, keine Conversations, Tools, Hintergrundjobs oder hochgeladenen Files. Rezept und minimale Importmetadaten werden gespeichert; vollständige Quelldaten werden nicht dauerhaft abgelegt. API-Daten werden laut OpenAI standardmäßig nicht zum Training verwendet; Missbrauchsprotokolle können ohne gesondert genehmigte Datenkontrollen dennoch bis zu 30 Tage aufbewahrt werden. `store:false` ist kein Zero-Data-Retention-Vertrag. [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data)

Keine Rohfehlermeldungen, Keys oder Quelltexte werden geloggt. Importhistorie speichert ausschließlich anwendungseigene Fehlercodes. Roh-E-Mails befinden sich ausschließlich in der privaten Mitgliederliste; diese ist nur für Admins abrufbar. Backups sind privat zu behandeln.

## Fremde URLs und SSRF

Nur HTTPS ohne Benutzer-/Passwortanteil, IP-Literale oder Sonderport. Links mit typischen Zugangsschlüssel-Parametern werden abgelehnt. Eine explizite, exakte `RECIPE_ALLOWED_HOSTS`-Liste ist Voraussetzung; keine Wildcards oder beliebigen nutzergesteuerten Domains. Jede Weiterleitung muss erneut erlaubt sein. Die eigene App und Workers-/Access-Hosts bleiben gesperrt.

Öffentliche A-/AAAA-Adressen werden zusätzlich über Cloudflares DNS-over-HTTPS geprüft. Private, reservierte, gemappte und lokale Adressen werden abgewiesen. Der eigentliche Abruf verwendet Workers globales Fetch ohne VPC-/Tunnel-/interne Service-Bindings. Authentifizierungsheader oder Cookies werden nicht weitergeleitet. Maximal drei Redirects, 15 Sekunden je Seitenabruf, 5 Sekunden je DNS-Prüfung und 2 MB HTML.

**Vertrauensannahme:** Workers-Fetch bietet hier kein anwendungsseitiges IP-Pinning wie der alte Node-Socketclient. Zwischen DNS-Prüfung und Abruf kann DNS wechseln. Deshalb ist die Betreiberfreigabe vertrauenswürdiger, stabiler Hosts zwingend und beliebige URL-Hosts sind bewusst nicht unterstützt. Keine internen Dienste über dieselben Hosts oder allein aufgrund von Cloudflare-Herkunftsheadern freigeben. Für zusätzliche Isolation müsste künftig eine gesonderte kontrollierte Egress-Lösung entworfen werden; diese Änderung führt keinen solchen Dienst ein. [Cloudflare zu Workers-Bindings und SSRF](https://blog.cloudflare.com/workers-environment-live-object-bindings/)

HTML und Transkripte sind nicht vertrauenswürdig; enthaltene Anweisungen werden als Benutzerdaten behandelt. Structured Outputs, erneute Schema-/Referenzprüfung und maskierte Browserausgabe begrenzen Folgefehler. Die Content Security Policy sperrt fremde Skripte, Frames und Netzwerkziele im Browser. Modellkorrektheit kann nicht allein durch JSON-Validierung bewiesen werden; sachliche Unklarheiten müssen sichtbar bleiben.

## Kosten und Missbrauch

Vor jedem KI-Aufruf wird in einer atomaren D1-Anweisung eine Reservierung angelegt. Standard: 5 Versuche je Nutzer/Minute, 30 je Nutzer/UTC-Tag, 2 parallel, 2 USD reserviertes Tagesbudget und 10 USD Monatsbudget. Konfigurierbar als Mikro-US-Dollar. Fehlgeschlagene Versuche zählen mit; abgelaufene Leases geben nur den Parallelitätsslot frei. Sie erstatten keine unklaren Kosten.

Reservierung verwendet die konfigurierten Tokenpreise, eine konservative UTF-8-Byteobergrenze für Eingabe plus Protokollreserve und maximal 6.000 Ausgabetokens. Keine automatischen SDK-Retries. Bei anderem Modell müssen Preise explizit gesetzt werden. Tokenverbrauch und geschätzte tatsächliche Kosten werden erfasst, wenn OpenAI sie liefert, auch bei inhaltlich abgewiesenen Antworten. Nach Verbindungsabbruch kann Verbrauch unbekannt sein; die Reservierung bleibt bestehen. Diese Grenzen ersetzen nicht die Abrechnung und Ausgabenbegrenzungen beim API-Anbieter.

Der aktuell implementierte Medienweg ist nur Text. Videolänge bis 20 Minuten ist eine Nutzerangabe; tatsächlich technisch erzwungen sind Textgröße, Anfragen, Parallelität und Kosten. Keine kostenauslösenden Endpunkte ohne verifizierte Identität und Mitgliedschaft. Automatisierte Tests enthalten ausschließlich Mocks und blockieren ungemockte Netzwerkaufrufe.

## Wartung

Betreiber verantwortet Access-Richtlinien, Mitgliedschaften, Secrets, geprüfte Hostliste, aktuelle Modellpreise, D1-Backups und Aktualisierungen. Sicherheitsrelevante Änderungen über geschützte PRs prüfen. Produktionsmigrationen erst nach Backup, SQL-Review und ausdrücklicher Freigabe durchführen. Keine persönlichen Daten oder Geheimnisse in öffentliche Issues posten.

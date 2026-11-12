# Sicherheit

## Verbindliche Betriebsgrenzen

Die Anwendung ist ein privates gemeinsames Kochbuch. Vor einer Veröffentlichung müssen Access, die bestehende D1-Datenbank, Admins und Worker Secrets konfiguriert werden. Die accountbezogene Konfiguration ersetzt keine geprüften Dashboard-Richtlinien, Mitgliedschaften und ausschließlich produktiv gebundenen Secrets. Es gibt weder automatische Produktionsmigrationen noch ein Deployment aus GitHub Actions.

## Authentifizierung und Rechte

Cloudflare Access schützt den gesamten Worker mit der Einstellung **All traffic**, einschließlich seiner kostenlosen `workers.dev`-Adresse, aller Pfade/API-Endpunkte und neuer Workers Previews. Eine Allow-Richtlinie enthält ausschließlich ausdrücklich freigegebene einzelne E-Mail-Adressen. Zusätzlich prüft der Worker jedes `Cf-Access-Jwt-Assertion` kryptografisch, einschließlich Aussteller, Audience und höchstens 24 Stunden Tokenalter. Access-Sitzungen entsprechend auf maximal 24 Stunden konfigurieren. Ungeschützte alternative Hosts dürfen nicht eingerichtet werden; `workers_dev:true` ist der vorgesehene primäre Zugang, alte Versions-URLs bleiben mit `preview_urls:false` deaktiviert. Alle Static Assets laufen zuerst durch den Worker. Direkte Identitätsheader werden nicht verwendet. Access-Aussteller müssen eine feste `*.cloudflareaccess.com`-Teamadresse sein; sie kommen nie aus dem Request.

Das JWT reicht allein nicht: E-Mail und Subject werden an eine aktive D1-Mitgliedschaft gebunden. Nicht eingeladene oder gesperrte Nutzer erhalten keinen Zugang. Initiale Admins werden ausschließlich aus `BOOTSTRAP_ADMIN_EMAILS` nach erfolgreicher JWT-Prüfung aufgenommen. Eine nachträglich geänderte Bootstrap-Liste befördert keine vorhandenen Mitglieder automatisch.

Mitglieder bearbeiten nur eigene Rezepte. Admins dürfen alle bearbeiten/löschen und Mitglieder verwalten. Der API-Endpunkt prüft dies unabhängig vom Frontend. Eigene Rolle/Aktivierung kann ein Admin nicht selbst ändern. Access-seitiges Entfernen allein kann noch laufende Tokens hinterlassen; für sofortigen App-Ausschluss zusätzlich die D1-Mitgliedschaft sperren.

## Lokale Entwicklung und Vorschauen

Lokale Testidentität ist nur bei `APP_ENV=local`, `AUTH_MODE=local` **und Loopback-URL** zulässig. Sie ist keine Produktionsanmeldung. Nicht mit einem öffentlichen Tunnel oder `--remote` betreiben. Standardlokalentwicklung verwendet ausschließlich lokal emuliertes D1.

Neue Workers Previews sind gesondert konfiguriert: die Audience der Worker-weiten Access-Anwendung auch für Vorschauen, keine D1-Bindung und kein OpenAI-Secret. Der Worker verweigert die Vorschau vollständig, wenn dort dennoch DB oder Key gebunden sind. Schreibzugriffe sind gesperrt. Keine produktiven Secrets in „Previews Base“ importieren. Bei fehlender Access-Konfiguration schlägt die Vorschau geschlossen fehl. GitHub Pages enthält nur den unveränderten öffentlichen UI-Prototyp und hat keine private Worker-Verbindung.

## Secrets und Datenschutz

`OPENAI_API_KEY` und `BOOTSTRAP_ADMIN_EMAILS` ausschließlich als Cloudflare Worker Secrets für Production hinterlegen. Die Admin-Adressen gehören nicht ins öffentliche Repository; der Release-Schutz lehnt sie im `vars`-Block ab. Eine Preview mit diesem Admin-Secret wird ebenfalls gesperrt. Die aktive Oberfläche hat kein Key-Formular; es existiert kein Endpunkt zum Speichern eines Keys. Lokal ist eine ignorierte `.dev.vars` möglich. Schlüssel, `.env*`, `.dev.vars*`, D1-Kopien und Laufzeitdateien sind ausgeschlossen. Beispiele enthalten nur Platzhalter. Die öffentlichen Pages-Dateien enthalten keinen echten Schlüssel.

OpenAI erhält ausschließlich den begrenzten für die Analyse nötigen Quelltext, keine Nutzer-E-Mail. `store:false` ist gesetzt, keine Conversations, Tools, Hintergrundjobs oder hochgeladenen Files. Rezept und minimale Importmetadaten werden gespeichert; vollständige Quelldaten werden nicht dauerhaft abgelegt. API-Daten werden laut OpenAI standardmäßig nicht zum Training verwendet; Missbrauchsprotokolle können ohne gesondert genehmigte Datenkontrollen dennoch bis zu 30 Tage aufbewahrt werden. `store:false` ist kein Zero-Data-Retention-Vertrag. [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data)

Keine Rohfehlermeldungen, Keys oder Quelltexte werden geloggt. Importhistorie speichert ausschließlich anwendungseigene Fehlercodes. Roh-E-Mails befinden sich ausschließlich in der privaten Mitgliederliste; diese ist nur für Admins abrufbar. Backups sind privat zu behandeln.

## Fremde URLs und SSRF

Nur HTTPS ohne Benutzer-/Passwortanteil, IP-Literale oder Sonderport. Links mit erkennbaren Zugangsschlüssel-Parametern werden abgelehnt, unter anderem access_token, apikey/API-KEY, Authorization, client_secret, session_id sowie X-Amz-/X-Goog-Signaturen. Namen werden unabhängig von Großschreibung, Trennzeichen und begrenzter Mehrfachkodierung geprüft; verschachtelte URL-Parameter ebenfalls. Die Fehlermeldung wiederholt weder URL noch Wert. Vor Reservierung und Speicherung validiert das Repository erneut; unsichere historische Quell-URLs werden in API-Sammlung und Historie als leere Quelle ausgegeben. Öffentliche Rezeptquellen benötigen keine vorherige Freigabe. `RECIPE_ALLOWED_HOSTS` ist eine optionale zusätzliche Einschränkung auf exakte Hostnamen; leer bedeutet öffentliche Quellen zulassen, keine Wildcard-Konfiguration nötig. Jede Weiterleitung wird erneut auf URL und öffentliche DNS-Adressen geprüft. Lokale Namensräume, die eigene App und Access-Anmeldedomains bleiben gesperrt.

Öffentliche A-/AAAA-Adressen werden zusätzlich über Cloudflares DNS-over-HTTPS geprüft. Private, reservierte, gemappte und lokale Adressen werden abgewiesen. Der eigentliche Abruf verwendet Workers globales Fetch ohne VPC-/Tunnel-/interne Service-Bindings. Authentifizierungsheader oder Cookies werden nicht weitergeleitet. Maximal drei Redirects, 15 Sekunden je Seitenabruf, 5 Sekunden je DNS-Prüfung und 2 MB HTML.

**Netzwerkgrenze:** Alle Wrangler-Konfigurationen aktivieren ausdrücklich `global_fetch_strictly_public`. Der Quellenabruf verwendet ausschließlich globales Workers-Fetch, das dadurch über den öffentlichen Zugang der Zielseite läuft und keine Origin-Sicherheitsregeln umgeht. Private Netzwerk-/Tunnel-/Service-Fetch-Bindings sind nicht Bestandteil dieses Workers und werden vom Release-Schutz abgelehnt. Cloudflares Isolation ist Teil der Sicherheitsannahme. Bei Selbsthosting mit einer anderen Laufzeit muss deren Egress private und reservierte Adressen ebenfalls beim Verbindungsaufbau sperren. Die vorherige DNS-Prüfung allein verhindert kein DNS-Rebinding, und Workers-Fetch bietet hier kein anwendungsseitiges IP-Pinning. Niemals private APIs allein anhand von Cloudflare-Herkunftsheadern freigeben. [Strictly-public-Fetch](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public), [Cloudflare zu Bindings und SSRF](https://blog.cloudflare.com/workers-environment-live-object-bindings/)

HTML und Transkripte sind nicht vertrauenswürdig; enthaltene Anweisungen werden als Benutzerdaten behandelt. Structured Outputs, erneute Schema-/Referenzprüfung und maskierte Browserausgabe begrenzen Folgefehler. Die Content Security Policy sperrt fremde Skripte, Frames und Netzwerkziele im Browser. Modellkorrektheit kann nicht allein durch JSON-Validierung bewiesen werden; sachliche Unklarheiten müssen sichtbar bleiben.

## Kosten und Missbrauch

Vor jedem KI-Aufruf wird in einer atomaren D1-Anweisung eine Reservierung angelegt. Standard: 5 Versuche je Nutzer/Minute, 30 je Nutzer/UTC-Tag, 2 parallel, 2 USD reserviertes Tagesbudget und 10 USD Monatsbudget. Konfigurierbar als Mikro-US-Dollar. Fehlgeschlagene Versuche zählen mit; abgelaufene Leases geben nur den Parallelitätsslot frei. Sie erstatten keine unklaren Kosten.

Reservierung verwendet die konfigurierten Tokenpreise, eine konservative UTF-8-Byteobergrenze für Eingabe plus Protokollreserve und maximal 6.000 Ausgabetokens. Keine automatischen SDK-Retries. Bei anderem Modell müssen Preise explizit gesetzt werden. Tokenverbrauch und geschätzte tatsächliche Kosten werden erfasst, wenn OpenAI sie liefert, auch bei inhaltlich abgewiesenen Antworten. Nach Verbindungsabbruch kann Verbrauch unbekannt sein; die Reservierung bleibt bestehen. Diese Grenzen ersetzen nicht die Abrechnung und Ausgabenbegrenzungen beim API-Anbieter.

Der aktuell implementierte Medienweg ist nur Text. Videolänge bis 20 Minuten ist eine Nutzerangabe; tatsächlich technisch erzwungen sind Textgröße, Anfragen, Parallelität und Kosten. Keine kostenauslösenden Endpunkte ohne verifizierte Identität und Mitgliedschaft. Automatisierte Tests enthalten ausschließlich Mocks und blockieren ungemockte Netzwerkaufrufe.

## Wartung

Betreiber verantwortet Access-Richtlinien, Mitgliedschaften, Secrets, öffentliche Egress-Isolation, optionale Quellenbeschränkungen, aktuelle Modellpreise, D1-Backups und Aktualisierungen. Sicherheitsrelevante Änderungen über geschützte PRs prüfen. Produktionsmigrationen erst nach Backup, SQL-Review und ausdrücklicher Freigabe durchführen. Keine persönlichen Daten oder Geheimnisse in öffentliche Issues posten.

## Grenzen der URL-Erkennung und manueller Nachweis

Eine URL kann Geheimnisse auch unter unbekannten Parameternamen oder im Pfad tragen. Heuristiken können das nicht allgemein erkennen. Nutzer dürfen nur öffentliche Rezeptlinks ohne Zugangsdaten einfügen; die Erkennung ist zusätzliche Absicherung, kein Beweis der Geheimnisfreiheit beliebiger Inhalte. Nicht sensible Query-Parameter werden für funktionierende Rezeptlinks und Duplikaterkennung erhalten. Bekannte sensible Links werden vollständig abgewiesen, statt nur den Parameter zu entfernen und versehentlich eine andere Quelle zu importieren.

Die API-Redaktion schützt vor Ausgabe bestehender unsicherer source_url-Werte; sie ist keine rückwirkende Datenbereinigung. Bei tatsächlichem Altbestand ist nach gesonderter Freigabe eine private Prüfung/Bereinigung und gegebenenfalls Rotation betroffener Zugangsdaten nötig. Tests verwenden ausschließlich erfundene Marker.

Die noch ausstehende [Live-Smoke-Test-Checkliste](docs/SMOKE-TEST.md) trennt lesende Access-/D1-Prüfungen, freizugebende Datenänderungen und gesondert freizugebende kostenpflichtige OpenAI-Aufrufe.

### Bilder fremder Rezeptseiten
Bilder sind nicht vertrauenswürdig. HTTPS, Secret-Query-Prüfung, öffentliche DNS-/Egress-Prüfung pro Redirect, maximal zwei Redirects, fünf Sekunden Abruf-Timeout je Hop, maximal 1 MiB und 16 Megapixel; nur JPEG/PNG/WebP mit passenden Signaturen. SVG/HTML werden abgewiesen. Diese Prüfung ist keine vollständige Bilddecoder-Validierung; beschädigte Bilder können vom Browser verworfen werden. Ausgabe ausschließlich über authentifizierte Same-Origin-Route mit nosniff und private/no-store. Keine Drittanbieter-Requests beim Öffnen; keine Original-Bild-URLs in API-Antworten. Quellen-/Urhebertexte werden escaped. Ein Quellenlink ersetzt keine Bildnutzungsrechte; Betreiber müssen die Nutzung für ihr privates Kochbuch prüfen.

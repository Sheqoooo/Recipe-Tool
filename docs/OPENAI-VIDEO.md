# Kurzvideo-Links, Modelle und Grenzen

Stand: 13. November 2026. Video-Uploads sind auf Nutzerwunsch ausgeschlossen. Kein kostenpflichtiger OpenAI-Aufruf in Entwicklungstests.

## Status und tatsächlicher Ablauf

Der Linkimport prüft zuerst öffentliche Rezeptbeschreibungen (mindestens zwei Mengen-/Einheitsangaben als Heuristik) und höchstens eine ausdrücklich verlinkte externe Rezeptseite. Das ist Textverarbeitung und wird am Rezept so gekennzeichnet. Ein Datum oder der Ausdruck „recipe video“ allein genügt nicht.

Neu implementiert, aber **standardmäßig deaktiviert**: automatischer Medienpfad für öffentlich zugängliche Instagram- und TikTok-Playerdaten. Er erfordert `VIDEO_ANALYSIS_ENABLED=true` UND das Cloudflare-Binding `MEDIA`. Es gibt kein Uploadformular und keine Übertragung von Videodateien aus dem Browser.

1. Instagram: normales öffentliches HTML der zugehörigen Einbettung auswerten; eine eindeutig auffindbare `video_url` aus JSON-Daten lesen. Höchstens vier begrenzte Entschachtelungsschritte, keine Script-Ausführung.
2. TikTok: öffentlich ausgeliefertes `__UNIVERSAL_DATA_FOR_REHYDRATION__` lesen, Item-ID gegen den aufgelösten Videolink prüfen. Nur `video.playAddr`, keine Downloader-/Login-Alternative.
3. Öffentlich erreichbare vollständige MP4-Datei bis **16 MiB / 90 Sekunden** vorübergehend laden. Dauer aus MP4-`moov/mvhd` prüfen; HTML-Dauerangaben sind kein Nachweis. Kein HLS, DASH, DRM, Live-Video oder Signaturentschlüsselung.
4. Zusätzliches Budget atomar in D1 reservieren, bevor Medienaufbereitung und OpenAI starten. Eine Medienanalyse zugleich. Die bestehende normale Importreservierung bleibt für reine Beschreibungen ausreichend.
5. Cloudflare Media Transformations extrahiert M4A-Audio (max. 2 MiB) und sechs JPEG-Bilder (je max. 512 KiB, 720 × 720 Begrenzungsrahmen) bei 5/23/41/59/77/95 Prozent der Dauer. Kein dauerhaftes Medienhosting, kein R2, kein eigener Rechner.
6. OpenAI Audio Transcriptions mit `gpt-4o-mini-transcribe`, anschließend Responses mit `gpt-6.1-terra`: Beschreibung, Transkript und Bilder erzeugen gemeinsam das strukturierte Rezept. Mengen dürfen nicht aus sichtbaren Handvoll-/Löffelbewegungen geraten werden.
7. Zod-/Referenzvalidierung wie beim Webseitenimport. Nur Rezept, kanonischer Original-Link, Hinweise und Verbrauchsmetadaten speichern. Keine Rohvideos, Bilderfolgen, Audio, vollständigen Transkripte oder signierten CDN-Adressen in D1/API/Logs.

Fehlen Zugriff, unterstütztes Format oder ausreichende Angaben, entsteht kein erfundenes Rezept. Bei fehlendem öffentlichen Medienzugriff erscheint `VIDEO_SOURCE_REQUIRED`; optional bereitgestellter Text bleibt eine ausdrücklich eingeschränkte Zwischenlösung. Sechs Bilder sind eine Stichprobe, keine lückenlose Sichtung. Kurze Texteinblendungen oder stumme Handlungen können fehlen. Stumme/ungeeignete Tonspuren können kontrolliert scheitern.

## Read-only-Nachweis an Nutzerbeispielen

Am 13. November 2026 ohne Login/Cookies geprüft:

| Beispiel | Beobachtung |
|---|---|
| Instagram `C-dcRN2JNk6` | Beschreibung enthält Rezeptmengen; öffentliche Einbettung liefert zusätzlich eine MP4-Adresse, HTTP 200, vollständiges MP4 mit 12.006.860 Bytes / 39,054 s aus Container geprüft |
| Instagram `Ddt0AqgMcUW` | Beschreibung allein enthält keine ausreichenden Mengen; öffentliche Einbettung liefert eine MP4-Adresse, öffentlicher Abrufausschnitt HTTP 206, Gesamtgröße laut Content-Range 13.521.786 Bytes |
| TikTok-Kurzlink zum Video `7683441157837163798` | Öffentliche Metadaten/Playeradresse vorhanden, direkter Medienabruf HTTP 403; keine Umgehung |

Dies belegt **nicht** die komplette Verarbeitung im produktiven Worker. Die CDN-Antworten sind zeit-, netz- und plattformabhängig. Keine signierten Originaladressen oder vollständigen Plattformseiten wurden als Testfixtures gespeichert.

## Plattformgrenzen

YouTube/Shorts: Linkerkennung, Beschreibung und rechtmäßig bereitgestellter Text; **automatischer Ton-/Bildzugriff noch nicht implementiert**. Die offizielle [Captions-Downloadmethode](https://developers.google.com/youtube/data/reference/rest/v3/captions/download) verlangt Bearbeitungsrechte. Keine allgemeine Fremd-Untertitel-API.

Instagram/TikTok: nur Daten, die die Plattform im normalen öffentlichen Player ausliefert UND deren Medienabruf tatsächlich erlaubt wird. Ein öffentlicher Post garantiert weder technischen Zugriff noch Nutzungsrechte. Keine Account-Cookies, privaten Videos, wechselnden Proxies, Challenge-Umgehung, Signaturentschlüsselung oder ungeprüften Downloader. Betreiber/Nutzer müssen die Berechtigung zur Verarbeitung und Plattformbedingungen prüfen. Die Anwendung verleiht keine Nutzungsrechte.

Die Meta-Beschreibungsprüfung bleibt heuristisch: auch zwei Mengen beweisen kein vollständiges Rezept. Ein vom Modell abgelehnter Beschreibungsimport wird derzeit nicht durch eine zweite kostenpflichtige Videoanalyse wiederholt.

## Modelle und Kosten

| Aufgabe | Standard | Status |
|---|---|---|
| Normaler Rezept-/Beschreibungs-/Transkripttext | GPT-6.1 Sol, low | Bestehender Standard |
| Video-Einzelbilder + Transkript | GPT-6.1 Terra | Implementiert, ausgeschaltet |
| Automatische Tontranskription | GPT-4o Mini Transcribe | Implementiert, ausgeschaltet |

`OPENAI_VIDEO_MODEL`, `VIDEO_INPUT_USD_PER_MILLION` und `VIDEO_OUTPUT_USD_PER_MILLION` konfigurieren die Bild-/Textgenerierung getrennt vom normalen Importmodell. Bei anderem Videomodell sind explizite Preise erforderlich. Audio ist vorerst bewusst auf Mini Transcribe beschränkt; kein ungeprüfter Modellwechsel mit falschen Kosten.

Sol: 2/10 USD je Million Eingabe-/Ausgabetokens. Beispiel 2.000 + 1.500 Tokens = 0,019 USD. Terra: 1/5 USD. Beispiel 5.000 Eingabetokens einschließlich Bildern + 2.000 Ausgabe + eine Audiominute à ungefähr 0,003 USD = **0,018 USD**. Annahmen, kein gemessener Durchschnitt; Bild-/Denk- und Textverbrauch variieren. Terra ist die begründete Startwahl für Vision, kein empirisch bewiesener Sieger im Kochvideovergleich.

Interne Medienreservierung beim Standardmodell: **239.000 Mikro-USD = 0,239 USD** (200.000 Eingabetokens, 6.000 Ausgabetokens, 90 Sekunden Audio mit zusätzlichem Schätzpuffer). Sie ist ein konservatives App-Kontingent, keine tatsächliche Rechnung oder garantierter Anbieter-Hard-Cap. Auch fehlgeschlagene Versuche behalten ihre Reservierung. Standardbudget 2 USD/Tag und 10 USD/Monat bleibt bestehen. Unter diesen Reservierungen sind weniger Importe möglich, als die tatsächlichen Beispielkosten vermuten lassen.

Gemeldete Tokenverbräuche werden addiert; Audio- und Texttokens sind verschiedene Modalitäten und kein direkt vergleichbarer Verbrauch. Audio-Kosten sind als laufzeitbasierte Näherung gekennzeichnet, Responses-Kosten anhand gemeldeter Tokens berechnet. Bei nachfolgendem KI-Fehler bleibt bereits bekannter Audioverbrauch am Fehlerdatensatz erhalten. Fehlende Verbrauchsdaten eines abgebrochenen Anbieteraufrufs lassen sich nicht nachträglich exakt rekonstruieren; Reservierung bleibt.

[OpenAI-Preise](https://developers.openai.com/api/docs/pricing), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Audio](https://developers.openai.com/api/docs/guides/speech-to-text), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Cloudflare, Datenschutz und Aktivierung

Die [Media-Transformations-Bindings](https://developers.cloudflare.com/stream/transform-videos/bindings/) sind laut offizieller Dokumentation derzeit öffentliche Beta; Binding-Transformationen werden während dieser Phase nicht berechnet. Das ist keine dauerhafte Preiszusage. Free-Worker-CPU-/Speichergrenzen gelten weiterhin; tatsächliche Laufzeit, Speicher und Verfügbarkeit im bestehenden Account sind **noch nicht live geprüft**. Kein Tarif wurde geändert und keine neue Ressource aktiviert.

Cloudflare erhält die Videobytes zur technischen Aufbereitung; OpenAI erhält die Tonspur und ausgewählten Bilder samt Text. `store:false` gilt für Responses; es ist keine Zusicherung von Nullaufbewahrung aller Anbieter-/Missbrauchsprotokolle. Audio unterstützt diesen Responses-Parameter nicht. [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data).

Abrufrahmen 45 Sekunden, native Medienaufbereitung 25 Sekunden, Audio 20 Sekunden, Rezeptgenerierung 45 Sekunden; keine automatischen SDK-Retries. Die bestehende D1-Lease beträgt 180 Sekunden. Ein Media-Timeout bricht das Warten ab; die Binding-API bietet in diesem Ablauf keine Stornierung einer schon gestarteten nativen Transformation. Deren Ergebnis wird verworfen und keine KI-Anfrage danach gestartet.

Quelltyp bleibt für neue Social-Importe `web`; flüchtige `provenance=public_video` steuert den tatsächlichen Verarbeitungsweg und den dauerhaften Prüfhinweis. Kein D1-Schemawechsel. Preview mit MEDIA, eingeschalteter Analyse oder produktiven Ressourcen wird serverseitig gesperrt. Aktivierungsschritte: [DEPLOYMENT.md](../DEPLOYMENT.md).

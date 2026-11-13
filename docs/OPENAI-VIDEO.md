# Kurzvideo-Links, Modelle und Grenzen

Stand: 13. November 2026. Keine kostenpflichtigen API-Aufrufe in Entwicklungstests. **Video-Uploads wurden auf Nutzerwunsch gestrichen.**

## Implementierter Ablauf

- YouTube einschließlich Shorts, Instagram-Reel-/Post-Links und TikTok-Video-/Kurzlinks werden erkannt. YouTube-IDs werden kanonisiert. Trackingparameter bei Instagram/TikTok werden erst nach der Prüfung auf Zugangsdaten entfernt.
- Der Server liest nur öffentlich erreichbares HTML. Ausreichende Meta-Beschreibungen werden aufbereitet. Falls die Beschreibung selbst kein erkennbares Rezept enthält, kann höchstens eine darin ausdrücklich verlinkte externe Rezeptseite über dieselben Sicherheitsprüfungen gelesen werden.
- Keine Anmeldung, Cookies, Plattform-API/oEmbed-Zweckentfremdung, Video-Downloads oder Umgehung von Zugriffsbeschränkungen. DNS-/IP-/Redirect-/Größenprüfungen bleiben erhalten. Ein gemeinsames Zeitfenster begrenzt Beschreibung und verlinkte Rezeptseite.
- Ist kein Rezept ausreichend auslesbar, gibt die API `VIDEO_SOURCE_REQUIRED` aus. Die App zeigt dies klar an. Die bisherige optionale Bereitstellung eines autorisierten Texts/Transkripts bleibt als Zwischenlösung erhalten, ohne sich bereits beim Einfügen eines Links zu öffnen.
- Es findet **keine Ton- oder Videobildanalyse** statt. Das gespeicherte Rezept weist ausdrücklich auf die tatsächlich verwendete Textgrundlage hin.
- Kein zusätzlicher Cloudflare-Dienst, Tarifwechsel, neuer API-Key oder D1-Migrationsschritt.

Metadatenzugriff ist heuristisch: Plattformen können Beschreibungen kürzen, HTML ändern, öffentliche Seiten blockieren oder Anmeldung verlangen. Ein erfolgreicher Linkimport bedeutet nur, dass ausreichend zugänglicher Rezepttext vorhanden war, nicht dass das Video gesehen wurde.

## Modelle und Empfehlung

Aktiv bleibt `OPENAI_MODEL=gpt-6.1-sol` für Webseiten, zugängliche Beschreibungen und bereitgestellte Texte. Responses API mit Structured Outputs und festem Schema, zusätzliche serverseitige Validierung, Denkaufwand low, maximal 20 KB Quelltext und 6.000 Ausgabetokens. Fehlende Mengen/Zeiten/Portionen werden nicht erfunden.

Für einen späteren rechtmäßigen **automatischen** Zugriff auf Mediendaten wäre meine begründete Startempfehlung:

| Aufgabe | Modell | Aktueller Status |
|---|---|---|
| Tonspur transkribieren | GPT-4o Mini Transcribe | Nur vorgeschlagen, nicht implementiert oder aktiviert |
| Ausgewählte Einzelbilder mit Text auswerten | GPT-6.1 Terra | Nur vorgeschlagen, nicht implementiert oder aktiviert |
| Aktueller Rezepttextimport | GPT-6.1 Sol | Implementiert |

Terra ist für visuelle Aufgaben ausgelegt; Luna ist günstiger. Ein realer Vergleich mit Kochvideos wurde nicht durchgeführt. Terra/Sol/Luna unterstützen Bild- und Texteingaben, aber keinen beliebigen Plattformlink als native Videoeingabe. Die Wahl löst deshalb nicht das vorgelagerte Zugriffsproblem.

Offizielle Quellen: [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Audio](https://developers.openai.com/api/docs/guides/speech-to-text), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Kosten

Sol kostet regulär 2 USD je Million Eingabe- und 10 USD je Million Ausgabetokens. Beispiel: 2.000 Eingabetokens plus 1.500 Ausgabetokens ergeben 0,019 USD pro Import. Zusätzliche Denktokens und tatsächliche Textlänge verändern den Verbrauch.

Für den vorgeschlagenen späteren Medienpfad: Terra regulär 1/5 USD je Million Eingabe-/Ausgabetokens; Mini Transcribe geschätzt 0,003 USD je Audiominute. Beispiel: 5.000 API-Eingabetokens inklusive Bildern, 2.000 Ausgabetokens und eine Audiominute ergeben 0,018 USD. Das ist nur eine Rechnung mit angenommenem Verbrauch, keine Prognose oder aktivierte Funktion. [Offizielle Preise](https://developers.openai.com/api/docs/pricing)

Unverändert: persistente Limits für Importhäufigkeit, Parallelität und konservative Tages-/Monatsreservierungen vor KI-Aufrufen, keine automatischen SDK-Retries, kontrollierte Timeouts/Fehler. Fehlgeschlagene Quellenzugriffe können interne Reservierungen verbrauchen, auch ohne tatsächlich kostenpflichtigen KI-Aufruf. Das interne Budget ist keine Anbieterrechnung.

## Daten und Plattformgrenzen

Nur Rezept, Quelle, Hinweise und Verbrauchsmetadaten werden gespeichert, keine vollständigen Beschreibungen/Transkripte. Beschreibungsimporte verwenden den bestehenden generischen Quelltyp `web`; der historische bereitgestellte YouTube-Textpfad behält `youtube_transcript`. Die Warnungen unterscheiden zugängliche Beschreibung/verlinkte Rezeptseite von bereitgestelltem Text.

`store:false` gilt für Responses, ist aber keine pauschale Zusicherung von Nullaufbewahrung sämtlicher Anbieterprotokolle. [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data)

YouTubes offizielle [Captions-Downloadmethode](https://developers.google.com/youtube/data/reference/rest/v3/captions/download) verlangt Bearbeitungsrechte am Video und wird nicht als allgemeiner Fremd-Untertitelabruf verwendet. Für beliebige Reels/Shorts/TikToks bleibt vollständiger automatischer Zugriff auf Ton und Bilder ungelöst. Die App behauptet diese Fähigkeit nicht.

Bereitgestellter Text: ausdrückliche Nutzungsbestätigung, 30 Zeichen bis 20 KB und angegebene Länge bis 20 Minuten. Die ursprüngliche Videolänge wird nicht verifiziert; tatsächlich erzwungene Kosten-/Eingabegrenze ist die Textgröße.

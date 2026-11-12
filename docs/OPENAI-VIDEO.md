# Kurzvideo-Import, Modelle und Grenzen

Stand: 13. November 2026. Entwicklungstests verwenden synthetische Dateien und gemockte OpenAI-Antworten. Es wurden keine kostenpflichtigen API-Aufrufe durchgeführt.

## Tatsächlicher Ablauf

1. YouTube (einschließlich Shorts), Instagram-Reel-/Post-Links und TikTok-Links werden erkannt. YouTube-IDs werden kanonisiert, Trackingparameter bei Instagram/TikTok nach der Prüfung auf Zugangsdaten entfernt.
2. Der Server versucht ausschließlich öffentlich erreichbares HTML auszulesen. Er prüft DNS, Zieladressen, jeden Redirect, Antwortgröße und Zeitlimit. Es wird kein Login automatisiert, kein Cookie hinterlegt und kein Video von der Plattform heruntergeladen.
3. Ausreichende öffentliche Beschreibungen werden verarbeitet. Enthält eine unzureichende Beschreibung eine externe Rezeptadresse, wird höchstens eine solche Seite über dieselben Sicherheitsprüfungen gelesen. Plattform-Login-Seiten oder nicht verfügbare Inhalte führen zur Alternative „Video oder Beschreibung bereitstellen“.
4. Nutzer können ausdrücklich autorisierten Text (30 Zeichen bis 20 KB, angegebene Länge maximal 20 Minuten) oder eine Videodatei mit Ton bereitstellen. Die Textlänge ist serverseitig begrenzt; eine manuell angegebene ursprüngliche Videodauer ist kein verifizierter Beleg.
5. Für Dateien prüft der Browser Typ, Größe, Metadaten und Dekodierbarkeit, extrahiert sechs zeitlich verteilte JPEG-Einzelbilder und eine Mono-WAV-Tonspur mit 16 kHz / 16 Bit. Die Originaldatei wird nicht zum Worker übertragen. Es gibt kein FFmpeg, keinen VPS, keinen zusätzlichen Speicherdienst und keine lokale KI.
6. Der Worker prüft das JSON-Limit (10 MB), Autorisierungserklärung, WAV-Struktur und tatsächliche PCM-Dauer, Frameanzahl, JPEG-Header/-Abmessungen und Dateigrößen vor der persistenten KI-Budgetreservierung. Anschließend: Audio-Transkription, dann strukturierte Rezeptgenerierung aus Transkript und Bildern. Ergebnisse werden unabhängig vom JSON Schema erneut serverseitig validiert.

Die bisherigen Access-, Mitglieds-, Rollen-, Origin-, Rate-, Parallelitäts- und Budgetprüfungen gelten auch für diese Importe. Es gibt keinen öffentlichen kostenverursachenden Medien-Endpunkt.

## Modelle und Auswahl

- **Normale Webseiten/Beschreibungen/Transkripte:** weiterhin `OPENAI_MODEL=gpt-6.1-sol`.
- **Tonspur:** `OPENAI_AUDIO_MODEL=gpt-4o-mini-transcribe`. Unterstützte Alternative: `gpt-4o-transcribe`.
- **Transkript plus Einzelbilder:** `OPENAI_VIDEO_MODEL=gpt-6.1-terra`, Responses API, Structured Outputs, Denkaufwand low und maximal 6.000 Ausgabetokens einschließlich Denktokens.
- Terra ist die begründete Startwahl für visuelle Auswertung; ein realer Qualitätsvergleich mit Kochvideos wurde noch nicht durchgeführt. Luna ist preiswerter, aber nicht aufgrund eines ungetesteten Qualitätsversprechens vorausgewählt.
- Für Terra sind regulär 1/5 USD, für Sol 2/10 USD je Million Eingabe-/Ausgabetokens hinterlegt. Andere Videomodelle benötigen eigene `VIDEO_MODEL_INPUT_USD_PER_MILLION` und `VIDEO_MODEL_OUTPUT_USD_PER_MILLION`.
- Die Audio-Schätzung beträgt 0,003 USD je Minute für Mini bzw. 0,006 USD je Minute für Transcribe. Verfügbare Audio-Tokenzahlen werden zusätzlich zu Vision-Tokens erfasst; die kombinierte Kostenschätzung ist keine Anbieterrechnung.

Offizielle Quellen: [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Preise](https://developers.openai.com/api/docs/pricing), [Transkription](https://developers.openai.com/api/docs/guides/speech-to-text), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Kosten und Limits

Beispiel für den Videopfad: 5.000 von der API gemeldete Eingabetokens inklusive Bildeingaben und 2.000 Ausgabetokens kosten mit Terra 0,015 USD. Eine Minute Mini-Transkription addiert geschätzt 0,003 USD: insgesamt 0,018 USD. Das Beispiel ist keine Prognose; Bilddetail, Auflösung, Transkriptlänge und Denktokens verändern den Verbrauch.

Die Vorabreservierung ist bewusst viel höher: standardmäßig 0,544 USD je Medienimport (konservative Bild-/Text-/Ausgabeobergrenze plus Audio-Puffer). Das interne Tages-/Monatsbudget zählt Reservierungen, auch nach Abschluss/Fehlern, wie bisher. Mit unverändert 2 USD Tagesbudget sind daher höchstens drei reine Medienversuche pro Tag möglich; andere Importe reduzieren dies. **Die Reservierung ist keine tatsächliche API-Abbuchung.** Budgets werden nicht automatisch erhöht.

- Originaldatei im Browser: MP4/MOV/WebM, maximal 20 MB und drei Minuten, Auflösung maximal 3840 × 2160 bzw. gedreht.
- Server: maximal sechs JPEGs, je 200 KB und höchstens 1280 Pixel pro Seite; kanonisches Mono-PCM-WAV mit maximal 180 Sekunden und 5.760.044 Bytes.
- Original-Containerdauer wird nur im Browser geprüft, da der Server die Originaldatei nicht erhält. Serverseitig erzwingen PCM-Dauer, Frameanzahl, Bytes und Budget die tatsächlichen Verarbeitungsgrenzen unabhängig von Clientangaben.
- Quellenabruf hat einen gemeinsamen Zeitrahmen von 45 Sekunden (DNS kann einen begonnenen Abruf noch kurz verlängern), maximal drei Redirects pro Seite und insgesamt höchstens eine weitere Rezeptseite.
- Audio und Responses haben jeweils 45 Sekunden Timeout, keine automatischen SDK-Retries. Abbrüche werden kontrolliert behandelt. Eine bereits erfolgte Audiostufe bleibt auch bei späterem Vision-Fehler in den Verbrauchsdaten berücksichtigt.
- Audiodateien ohne Videobilder haben noch keinen eigenen Uploadpfad.

## Erforderliche Einrichtung

Der bestehende serverseitige Worker-Secret `OPENAI_API_KEY` bleibt der einzige Schlüssel. Ein auf Responses eingeschränkter Key benötigt zusätzlich Schreibzugriff auf **Audio / Transcriptions**. Rechte selbst im OpenAI-Dashboard ändern; keine Keys in Chat, Repository oder Browser hinterlegen. Bei fehlenden Rechten liefert die App eine kontrollierte Einrichtungsmeldung.

Keine D1-Migration und keine zusätzliche Datenbank erforderlich. Automatische Beschreibung und bereitgestellte Medien verwenden den bestehenden generischen Quelltyp `web`; der historische YouTube-Textpfad behält `youtube_transcript`. Aussagekräftige Hinweise am Rezept beschreiben die tatsächlich verwendete Grundlage. Diese Kompatibilität vermeidet eine produktive Schemaänderung und ist kein Beleg für native Plattform-Videoanalyse.

## Ehrliche Grenzen und Datenschutz

- Ein beliebiger Plattform-Link ist kein unterstütztes Video-Eingabeformat für Terra oder Sol. Die Modelle bekommen explizit Text und ausgewählte Bilder; Audio hat einen separaten Endpunkt.
- Plattformseiten können blockieren, Beschreibungen kürzen oder nur nach Login anzeigen. Metadatenprüfung ist heuristisch, kein garantierter Zugriff. Kein Downloader, keine Plattform-API-/oEmbed-Zweckentfremdung und keine Umgehung von Zugriffsbeschränkungen.
- YouTubes offizielle [Captions-Downloadmethode](https://developers.google.com/youtube/data/reference/rest/v3/captions/download) setzt Bearbeitungsrechte am Video voraus. Sie wird hier nicht als allgemeiner Untertitelabruf verwendet.
- Sechs Bilder können kurze Einblendungen verpassen. Fehlende Mengen werden nicht ergänzt; unklare Angaben werden im Rezept gekennzeichnet.
- Manche Video-/Audio-Codecs, stille Videos oder Dateien ohne lesbare Dauer werden abgewiesen. Browser-/iPhone-Unterstützung muss mit realen freigegebenen Beispielen geprüft werden. Synthetischer Chromium-Test ist keine iOS-Geräteprüfung.
- Es werden nur Rezept, Quelle, Hinweise und Verbrauchsmetadaten in D1 gespeichert. Originalvideo, WAV, Frames und vollständiges Transkript werden dort nicht abgelegt; es werden keine Dateien über die OpenAI Files API gespeichert.
- Responses nutzt `store:false`. Das ist keine pauschale Zusicherung von Nullaufbewahrung für sämtliche Anbieterprotokolle oder Audioverarbeitung. Maßgeblich sind die [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data).

## Produktionsfreigabe

Der Dateipfad bleibt produktiv mit `MEDIA_UPLOAD_ENABLED=false` gesperrt, während öffentliche Beschreibungen und bereitgestellte Texte nutzbar sind. Lokal und in der Offline-Demo ist Medienaufbereitung mit synthetischen Dateien testbar. Die größeren Mediendaten passen nicht garantiert in 10 ms CPU des Workers-Free-Tarifs. Vor Aktivierung sind Hosting-Laufzeit/Kosten und Audio-Berechtigung ausdrücklich zu klären; keine automatische Tarifbuchung. Siehe [Deployment](../DEPLOYMENT.md).

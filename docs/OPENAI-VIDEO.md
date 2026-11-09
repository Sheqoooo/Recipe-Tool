# OpenAI-Auswahl, Mediengrenzen und Kosten

Dokumentationsprüfung: 9. November 2026. Es wurden keine echten API-Aufrufe durchgeführt.

## Aktiver Pfad

Die Generierung verwendet das offizielle `openai`-SDK und die **Responses API** mit Structured Outputs. Modell: **`gpt-5.4-mini`**, konfigurierbar über `OPENAI_MODEL`. Dieses Modell unterstützt Responses, strukturiertes JSON sowie Text-/Bildeingabe; seine Modellseite weist Audio und Video als nicht unterstützt aus. Gewählt für klar begrenzte Rezeptextraktion mit niedrigen Kosten, nicht als Behauptung, das neueste oder beste Modell für jede Aufgabe zu sein. [Offizielle Modellseite](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

Das gemeinsame Zod-Schema erzeugt das JSON Schema. Die Antwort wird unabhängig davon erneut serverseitig geprüft. `store:false`, keine Conversations/Files/Tools und keine automatischen SDK-Retries. Maximal 20 KB Quelltext und 6.000 Ausgabetokens. Fehlende Mengen, Zeiten oder Portionen bleiben `null`; Modellangaben sind trotz formaler Validierung nicht automatisch sachlich bewiesen. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## Aktuelle Medienmöglichkeiten

| Eingabe | Offizieller Weg / tatsächlicher Projektstand |
| --- | --- |
| Rezepttext | Responses API; implementiert für Webseiten und bereitgestellte Transkripte |
| Bilder / einzelne Videoframes | Vision-fähige Modelle mit Bildeingaben; technisch geeigneter späterer Adapter, in dieser Version kein Upload/Frame-Extractor |
| Bereitgestelltes Audio | Audio Transcriptions API kann Audiodateien transkribieren; eigener sicherer Upload-/Dauerprüfpfad noch nicht implementiert |
| Beliebiger YouTube-Link | Kein allgemeiner Video-Download oder automatischer Untertitelimport implementiert |
| Videodatei | Kein Upload/Decoding/FFmpeg; keine native Videoanalysefähigkeit behauptet |

Die [Vision-Dokumentation](https://developers.openai.com/api/docs/guides/images-vision) beschreibt Bildeingaben, die [Audio-Dokumentation](https://developers.openai.com/api/docs/guides/speech-to-text) den gesonderten Transkriptionsweg. Aus der grundsätzlichen Multimodalität eines Modells folgt nicht, dass ein beliebiger YouTube-Link eine unterstützte API-Eingabe wäre.

## YouTube-Alternative

Die offizielle YouTube-Captions-Downloadmethode verlangt Berechtigung zur Bearbeitung des Videos. Ein API-Key allein erlaubt keinen allgemeinen Abruf fremder Untertitel. Daher wird weder ein ungeprüfter Downloader noch eine Umgehung von Plattformbeschränkungen eingebaut. [YouTube Captions: download](https://developers.google.com/youtube/data/reference/rest/v3/captions/download)

Implementiert: YouTube-Link erkennen, ein vom Nutzer rechtmäßig bereitgestelltes Transkript nach ausdrücklicher Bestätigung übernehmen und daraus ein Rezept erzeugen. Obergrenzen: 20 KB Text und angegebene Länge bis 20 Minuten. Die Laufzeit des eigentlichen Videos wird dabei nicht verifiziert. Der gespeicherte Hinweis sagt ausdrücklich, dass keine Bildanalyse stattgefunden hat. Für einen späteren Audio-/Frame-Adapter müssen MIME-/Dateiprüfung, tatsächliche Dauer, Uploadgröße, maximale Framezahl und eine passende Kostenreservierung ergänzt werden.

## Kostenmodell

Laut Modellseite kostet GPT-5.4 Mini regulär **0,75 USD je Million Eingabetokens** und **4,50 USD je Million Ausgabetokens**. Beispiel: 2.000 Eingabetokens und 1.500 Ausgabetokens ergeben **0,00825 USD je Import**, also etwa **0,83 USD je 100 Importe**, vor Steuern/Währungsumrechnung. Tatsächliche Länge und Ausgabe beeinflussen den Verbrauch. Transkripttext nutzt denselben Texttarif; Audio-/Bildkosten entstehen im implementierten Pfad nicht. [Preise](https://developers.openai.com/api/docs/models/gpt-5.4-mini)

Die Anwendung speichert Input-/Output-Tokens und eine Schätzung in Mikro-US-Dollar. Die Budgetreservierung ist absichtlich größer als ein typischer Import und wird nach Fehlern nicht erstattet. Bei Modellwechsel müssen `MODEL_INPUT_USD_PER_MILLION` und `MODEL_OUTPUT_USD_PER_MILLION` gesetzt werden. Die Schätzung behandelt Cache-Rabatte konservativ wie reguläre Eingabe. Kein Ersatz für die Rechnung des API-Anbieters.

## Aufbewahrung

Quelldaten werden nach der Rezeptverarbeitung nicht in D1 abgelegt. `store:false` verhindert reguläre Speicherung als abrufbares Response-Objekt; es garantiert ohne entsprechende Anbietervereinbarung keine vollständige Nullaufbewahrung in Missbrauchsprotokollen. Der Betreiber muss die geltenden OpenAI-Datenkontrollen prüfen. [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data)

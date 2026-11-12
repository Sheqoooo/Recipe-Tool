# OpenAI-Auswahl, Mediengrenzen und Kosten

Dokumentationsprüfung: 9. November 2026. Es wurden keine echten API-Aufrufe durchgeführt.

## Aktiver Pfad

Die Generierung verwendet das offizielle `openai`-SDK und die **Responses API** mit Structured Outputs. Modell: **`gpt-6.1-sol`**, konfigurierbar über `OPENAI_MODEL`. Dieses Modell unterstützt Responses, strukturiertes JSON sowie Text-/Bildeingabe; seine Modellseite weist Audio und Video als nicht unterstützt aus. Auf ausdrücklichen Nutzerwunsch gewählt; verwendet `reasoning.effort: low` für die begrenzte Rezeptextraktion. Die Ausgabe bleibt auf 6.000 Tokens begrenzt, einschließlich Denktokens. Modell und Tokenpreise bleiben konfigurierbar. [Offizielle Modellseite](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

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

Laut Modellseite kostet GPT-6.1 Sol regulär **2,00 USD je Million Eingabetokens** und **10,00 USD je Million Ausgabetokens**. Beispiel: 2.000 Eingabetokens und 1.500 Ausgabetokens ergeben **0,019 USD je Import**, also etwa **1,90 USD je 100 Importe**, vor Steuern/Währungsumrechnung. Tatsächliche Länge, Ausgabe und zusätzliche Denktokens beeinflussen den Verbrauch. Das Beispiel ist keine garantierte Obergrenze; die bestehende konservative Reservierung und Tages-/Monatsbudgets bleiben aktiv. Kein echter API-Aufruf wurde für diesen Modellwechsel ausgeführt; Projektzugang und reale Ausgabequalität müssen beim nächsten freigegebenen Import bestätigt werden. Transkripttext nutzt denselben Texttarif; Audio-/Bildkosten entstehen im implementierten Pfad nicht. [Preise](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

Die Anwendung speichert Input-/Output-Tokens und eine Schätzung in Mikro-US-Dollar. Die Budgetreservierung ist absichtlich größer als ein typischer Import und wird nach Fehlern nicht erstattet. Bei Modellwechsel müssen `MODEL_INPUT_USD_PER_MILLION` und `MODEL_OUTPUT_USD_PER_MILLION` gesetzt werden. Die Schätzung behandelt Cache-Rabatte konservativ wie reguläre Eingabe. Kein Ersatz für die Rechnung des API-Anbieters.

## Aufbewahrung

Quelldaten werden nach der Rezeptverarbeitung nicht in D1 abgelegt. `store:false` verhindert reguläre Speicherung als abrufbares Response-Objekt; es garantiert ohne entsprechende Anbietervereinbarung keine vollständige Nullaufbewahrung in Missbrauchsprotokollen. Der Betreiber muss die geltenden OpenAI-Datenkontrollen prüfen. [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data)

## Produktziel und aktueller Zwischenstand

Der automatische YouTube-Videoimport ist weiterhin das langfristige Produktziel. Der bereitgestellte Transkripttext ist ausdrücklich eine eingeschränkte Zwischenlösung: Ohne Text kein Rezeptimport aus dem Link, keine automatische Beschaffung, keine visuelle/akustische Prüfung. Diese Einschränkung wird auch in der aktiven Oberfläche angezeigt. Der spätere automatische Weg muss zunächst einen technisch zuverlässigen und rechtmäßigen Zugriff auf Medien/Transkripte sowie eigene Dauer-, Größen- und Kostenlimits erhalten. [Manuelle Prüfungen](SMOKE-TEST.md) kennzeichnen den Transkripttest getrennt vom noch fehlenden Videoimport.

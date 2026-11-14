# Änderungsverlauf

## 2026-11-14 – Einkaufsliste archiviert, einzelne Bring!-Zutaten

- Interne Einkaufsliste und Kochplanung aus Frontend, API, Datenabfragen, Build, Manifesten und Icons entfernt; vollständiger Quellstand unter `archive/shopping-list/` archiviert.
- Plus neben jeder Rezeptzutat sendet nur diese gespeicherte Zutat an Bring!; Sammelversand entfernt. Einzelne Positionen separat deduplizieren und schnelle Klicks seriell übertragen.
- Keine produktive Datenlöschung oder neue Migration. Historische Tabellen und GitHub Pages bleiben erhalten; Build-Prüfungen verhindern versehentliche Archivauslieferung.

## 2026-11-14 – Bring!-Aufrufkontext

- Bring!-Transport ohne falschen Client-Receiver aufrufen, damit natives workerd-fetch nicht vor dem Netzwerkzugriff mit „Illegal invocation“ scheitert.
- Regression mit echter Cloudflare-fetch-Funktion und ausschließlich lokalen Datenantworten ergänzt; Secrets, Schema und produktive Daten unverändert.

## 2026-11-14 – Bring!-Antwortverarbeitung

- Nicht unterstütztes `redirect: error` durch Workers-kompatibles `manual` mit expliziter 3xx-Sperre ersetzt; echter Request-Konstruktionstest verhindert Rückfall.

- JSON bei Bring! explizit anfordern und auch bei Klartext-/fehlender Kennzeichnung streng validieren; HTML/XML bleiben gesperrt.
- Sichere Fehlercodes für Phase, Netzwerk, Zeitüberschreitung und Antwortverarbeitung statt einer einzigen Sammelmeldung.
- Keine Änderung an Datenbank oder Credentials, keine automatischen Schreibwiederholungen.

## 2026-11-14 – Optionale direkte Bring!-Übertragung

- Gemeinsame Bring!-Zielliste durch Administratoren auswählen; Mitglieder senden gespeicherte Rezeptzutaten samt Mengen.
- Worker-Secrets für Bring!-Anmeldung, isolierte Vorschauen, begrenzter HTTP-Adapter und persistenter Doppelklick-/Rate-Schutz; keine zusätzliche KI.
- Versionierte optionale Migration 0006 vorbereitet; keine produktiven Migrationen, Listen-Schreibtests oder automatische Veröffentlichung.

## 2026-11-14 – Access-Sitzungen und erneute Anmeldung

- Einmonatige Access-Sitzungen anhand der signierten Ablaufzeit akzeptieren; widersprüchliche zusätzliche 24-Stunden-Grenze entfernt.
- Ungültige/abgelaufene Sitzungen bleiben gesperrt; HTML-Seiten bieten eine öffentliche Anmeldehilfe, APIs behalten JSON/401 und die Oberfläche zeigt einen dauerhaften Anmeldelink.
- Keine Änderung an Access-Richtlinien, Datenbankschema oder produktiven Daten; keine kostenpflichtigen Testanfragen.

## 2026-11-13 – Rezeptwünsche und Varianten

- Optionales Feld „Rezept anpassen“ unter dem Linkfeld; Zutaten und Zubereitung werden im bestehenden KI-Aufruf gemeinsam berücksichtigt.
- Originale und angepasste Varianten getrennt speichern; identische normalisierte Wünsche wiederverwenden und die Herkunft sichtbar erhalten.
- Wünsche nach erfolgreichem Import zurücksetzen; bei Fehlern und beim Zuklappen erhalten. Für mobile Nutzung und reduzierte Bewegung angepasst.
- 213 Worker-/D1-/Logiktests und 42 Browserprüfungen mit Mocks erfolgreich; keine kostenpflichtigen OpenAI-Testaufrufe.

## 2026-11-13 – Kurzvideos und Videostandbilder

- Öffentliche Instagram-/TikTok-Playerdaten mit begrenztem Audio-/Bildpfad über Cloudflare Media Transformations und OpenAI auswerten, soweit der Medienabruf möglich ist. Automatische YouTube-Medien bleiben eingeschränkt.
- Echte Videostandbilder mit Originalquelle speichern und fehlende Bilder eigener Rezepte nachladen; Hochkantbilder im Rezept vollständig einpassen.
- Erfolgreiche Linkimporte leeren die Eingabemaske. Vorhandene Bilder und ursprüngliche Rezeptfassungen bleiben erhalten.

## 0.3.0 – Cloudflare-Migration (zur Prüfung)

- Bestandsaufnahme und technische Entscheidungen dokumentiert; vorhandene Gestaltung und Einkaufslogik erhalten.
- Node-/Dateisystem-Backend durch TypeScript-Worker, relationale D1-Migration und gemeinsame Schema-/Typdefinitionen ersetzt.
- Access-JWT, aktive Mitgliedschaften, Besitzerrechte und Adminverwaltung ergänzt; kein Key-Eingabeformular mehr in der privaten App.
- Responses API über offizielles SDK mit Structured Outputs, Timeout, kontrollierten Fehlern und Verbrauchserfassung.
- Unbekannte Portionen/Zeiten bleiben `null`; Schritte referenzieren Zutaten und zeigen Mengen direkt an.
- Dauerhafte Rate-, Parallelitäts- und Kostenreservierungen in D1, begrenzte öffentliche Quellen ohne Pflicht-Hostliste; optionale zusätzliche Hostbeschränkung.
- YouTube-Erkennung und bereitgestellte Transkripte; kein Video-/Untertitel-Downloader oder unzutreffendes Videoanalyseversprechen.
- Getrennte lokale/produktive Wrangler-Konfiguration und schreibgeschützte Access-Preview ohne D1/KI.
- Testworkflow ohne Deployment, SQL-Migrationen ausschließlich lokal getestet; keine produktiven Ressourcen geändert.
- README, ARCHITECTURE, SECURITY, DEPLOYMENT und AGENTS auf die tatsächliche Architektur ausgerichtet. GitHub Pages unverändert.

### Ergänzungen nach externem Review

- Große Webseiten auf den Rezeptkern reduzieren: JSON-LD-Metadaten auslassen, Rezeptkarten und vollständige Zutaten-/Zubereitungsabschnitte priorisieren; keine still abgeschnittenen Kochangaben.
- Erweitertes Erkennen sensibler Quell-URLs einschließlich OAuth-/API-/Cloud-Signaturparametern und Kodierungsvarianten. Validierung vor Speicherung, Ausblenden unsicherer historischer Quell-URLs in API-Ausgaben.
- Zutaten/Schritte nur für die ausgewählten 500 Rezepte laden und linear zuordnen. Versionierte Migration 0002 ergänzt den Listenindex; keine Remote-Anwendung.
- Konkrete noch ausstehende Live-Smoke-Test-Checkliste; automatischer YouTube-Videoimport bleibt Produktziel, Transkriptimport ist ausdrücklich nur ein eingeschränkter Zwischenstand.

## 0.2.1 – 2026-11-09

- GitHub-Pages-Einstieg ergänzt: gestaltete Oberflächenvorschau statt automatisch angezeigter README.
- Statische Vorschau zeigt ihren Status und sendet keine API-Anfragen; Desktop-/Mobiltests decken auch den Pages-Projektpfad ab.
- Relative Verweise auf CSS und JavaScript lassen die Gestaltung auch bei direkt geöffneter HTML-Datei laden.
- Dateivorschau zeigt eine Startanleitung und sperrt Import sowie Key-Eingabe, bis die App über den Server geöffnet wird.
- Browser-Regressionsprüfung für die direkt geöffnete Datei auf Desktop und Mobil ergänzt.

## 0.2.0 – 2026-11-09

- Python-Hintergrund vollständig durch JavaScript auf Node.js 24 ersetzt; SQLite-Schema bleibt kompatibel.
- Linkimport speichert vollständige Rezepte direkt. Keine obligatorische Entwurfsmaske mehr.
- Textimport und manuelles Neuanlegen entfernt. Bearbeitung dient nachträglichen Korrekturen.
- Identische Links und gleichzeitig laufende gleiche Importe vermeiden zusätzliche KI-Aufrufe.
- Passwortschutz für Hosting, HTTPS-/Domain-Konfiguration, Healthcheck und begrenzte Importparallelität ergänzt.
- Dockerfile, Compose, Umgebungsbeispiel, Hosting-Anleitung und GitHub-Actions-Tests ergänzt.
- Node-Tests sowie Desktop-/Mobil-Browsertests verwenden simulierte KI ohne API-Kosten.
- Dokumentation auf den tatsächlichen JavaScript-Aufbau aktualisiert. Videoanalyse bleibt zurückgestellt.

## 0.1.0 – 2026-11-09

Erste technische Grundstruktur:

- Lokale Python-Anwendung ohne zusätzliche Pakete und ohne App-Konto.
- SQLite für Rezeptsammlung, Kochliste und Einkaufs-Häkchen.
- HTML-Import mit Erkennung strukturierter Rezeptdaten.
- Optionale deutsche KI-Aufbereitung über persönlichen OpenAI-API-Key.
- Bearbeitung, Suche, Portionsauswahl, gemeinsame Einkaufsliste und JSON-Export.
- Vorbereitete `Source`-Übergabe für spätere Videoquellen.
- 22 automatisierte Tests für Verarbeitung, Speicherung und lokale API.
- MIT-Lizenz und Dokumentation von Einrichtung, Architektur und Produktanforderungen.

Bekannte Abweichung vom vereinbarten Produktablauf: Ein Import öffnet noch einen Entwurf zur manuellen Bestätigung. Im nächsten Schritt soll ein Link direkt ein gespeichertes Rezept erzeugen; die Bearbeitung wird auf nachträgliche Korrekturen beschränkt. Videoanalyse ist zurückgestellt. Echte KI-Aufrufe und visuelle Browserprüfung sind noch nicht verifiziert.

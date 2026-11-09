# Änderungsverlauf

## 0.3.0 – Cloudflare-Migration (zur Prüfung)

- Bestandsaufnahme und technische Entscheidungen dokumentiert; vorhandene Gestaltung und Einkaufslogik erhalten.
- Node-/Dateisystem-Backend durch TypeScript-Worker, relationale D1-Migration und gemeinsame Schema-/Typdefinitionen ersetzt.
- Access-JWT, aktive Mitgliedschaften, Besitzerrechte und Adminverwaltung ergänzt; kein Key-Eingabeformular mehr in der privaten App.
- Responses API über offizielles SDK mit Structured Outputs, Timeout, kontrollierten Fehlern und Verbrauchserfassung.
- Unbekannte Portionen/Zeiten bleiben `null`; Schritte referenzieren Zutaten und zeigen Mengen direkt an.
- Dauerhafte Rate-, Parallelitäts- und Kostenreservierungen in D1, begrenzte Quellen und explizite Hostfreigaben.
- YouTube-Erkennung und bereitgestellte Transkripte; kein Video-/Untertitel-Downloader oder unzutreffendes Videoanalyseversprechen.
- Getrennte lokale/produktive Wrangler-Konfiguration und schreibgeschützte Access-Preview ohne D1/KI.
- Testworkflow ohne Deployment, SQL-Migrationen ausschließlich lokal getestet; keine produktiven Ressourcen geändert.
- README, ARCHITECTURE, SECURITY, DEPLOYMENT und AGENTS auf die tatsächliche Architektur ausgerichtet. GitHub Pages unverändert.

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

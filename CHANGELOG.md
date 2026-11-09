# Änderungsverlauf

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

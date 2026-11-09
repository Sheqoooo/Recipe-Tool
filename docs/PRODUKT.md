# Produktanforderungen

Stand: 9. November 2026. Diese Datei hält die vereinbarten Anforderungen fest. Sie unterscheidet den gewünschten Ablauf von der aktuell implementierten Grundstruktur.

## Zweck

Rezeptwerk sammelt Rezepte aus Links, formuliert sie auf Deutsch, vereinheitlicht Maße und speichert sie lokal. Aus ausgewählten Rezepten entsteht eine gemeinsame Einkaufsliste mit anpassbaren Portionen.

## Vereinbarter Hauptablauf

1. Die Startansicht zeigt ein Linkfeld und eine Importaktion.
2. Der Nutzer fügt einen Rezeptlink ein und startet den Import.
3. Die App ruft die Quelle ab, erkennt das Rezept und bereitet es automatisch auf Deutsch auf.
4. Zutatenmengen, Einheiten, Temperaturen und Zubereitungsschritte werden strukturiert gespeichert. Die Originalquelle und der ausgelesene Inhalt bleiben erhalten.
5. Bei erfolgreicher Verarbeitung landet das Rezept **direkt in der Datenbank**. Es öffnet sich keine obligatorische Bearbeitungs- oder Bestätigungsmaske.
6. Ein gespeichertes Rezept kann bei Bedarf nachträglich korrigiert werden.

Manuelles Erfassen und Einfügen von Rezepttext sind kein Bestandteil der gewünschten Hauptoberfläche. Die erste Implementierung enthält diese Funktionen noch und muss entsprechend angepasst werden.

## Fehler und Unsicherheit

- Ist die Quelle blockiert oder kein Rezept erkennbar, zeigt die App eine verständliche Fehlermeldung. Ein leerer Rezeptdatensatz soll nicht gespeichert werden.
- Fehlt der API-Key, soll die App zur Einrichtung führen. Ohne KI darf sie nicht behaupten, ein fremdsprachiges Rezept übersetzt zu haben.
- Fehlende Mengen werden nicht erfunden. Unsichere Angaben bleiben sichtbar gekennzeichnet und können später korrigiert werden.
- Cups lassen sich nur zutatenabhängig in Gramm umrechnen. Annahmen müssen nachvollziehbar bleiben.
- Fahrenheit-Umrechnung darf keine nicht genannte Ofenart wie Umluft oder Ober-/Unterhitze erfinden.

## Sammlung und Einkaufsliste

- Gespeicherte Rezepte durchsuchen, ansehen und bei Bedarf korrigieren.
- Ein oder mehrere Rezepte zur Kochliste hinzufügen und gewünschte Portionen einstellen.
- Einkaufsmengen aus Rezeptmengen und Portionen deterministisch berechnen.
- Identische Zutaten mit kompatiblen Einheiten zusammenführen. Frische Tomaten und Dosentomaten bleiben getrennt.
- Unbekannte Mengen und unterschiedliche Hinweise nicht stillschweigend zusammenrechnen.
- Vorhandene oder gekaufte Zutaten abhaken. Ändert sich die Planung, dürfen alte Häkchen nicht geänderte Mengen verdecken.

## Betrieb und Eigentum

- Quelloffener Anwendungscode unter MIT-Lizenz.
- Lokale SQLite-Datenbank; kein Supabase- oder anderer Datenbank-Account erforderlich.
- Die App läuft nur während der Nutzung. Keine dauerhaft laufende lokale KI nötig.
- Automatische KI-Aufbereitung über einen persönlichen OpenAI-API-Key. API-Verbrauch ist separat vom ChatGPT-Plus-Abo zu bezahlen.
- Geheimnisse und persönliche Rezeptdaten werden nicht ins Git-Repository aufgenommen.
- Die optionale externe KI ist kein quelloffener Bestandteil der App; dieser Unterschied muss dokumentiert bleiben.

## Später: Instagram und Video

Video-Auswertung ist ausdrücklich zurückgestellt. Eine spätere Quellenanbindung soll zunächst verfügbare Rezeptbeschreibungen verwenden und bei Bedarf Ton und ausgewählte Videobilder auswerten. Der Zugriff auf Instagram muss gesondert erprobt werden; eine zuverlässige Auswertung beliebiger Instagram-Links ist nicht zugesichert.

Die technische Übergabe `Source` ist bereits vorhanden. Videoabruf, Upload, Transkription und Bildanalyse sind noch nicht implementiert.

## Aktueller Stand

| Bereich | Stand |
| --- | --- |
| Lokaler Server und SQLite | Implementiert |
| Linkabruf und schema.org-Rezepterkennung | Implementiert; konkrete Webseiten können Abrufe blockieren |
| KI-Aufbereitung über persönlichen API-Key | Implementiert; noch nicht mit einem echten Key verifiziert |
| Direkte Speicherung nach Linkimport | Noch umzusetzen; aktuell erscheint ein Entwurf |
| Auf ein Linkfeld reduzierte Startansicht | Noch umzusetzen |
| Nachträgliche Bearbeitung und Sammlung | Implementiert |
| Kochliste, Portionsberechnung und Einkaufsliste | Implementiert und über lokale API getestet |
| JSON-Export | Implementiert; kein JSON-Reimport |
| Video-Auswertung | Zurückgestellt |
| Visuelle Browserprüfung | Durch die aktuelle Ausführungsumgebung blockiert |

## Abnahme des nächsten Entwicklungsschritts

- Ein gültiger Rezeptlink mit eingerichtetem API-Key erzeugt ohne weitere manuelle Eingabe einen gespeicherten Datensatz.
- Der Import öffnet keine Bearbeitungsmaske und benötigt keine zweite Bestätigung.
- Nach erfolgreichem Import wird das gespeicherte Rezept oder die aktualisierte Sammlung angezeigt.
- Die Startansicht verlangt ausschließlich einen Link.
- Korrekturen sind aus dem gespeicherten Rezept erreichbar.
- Bei fehlendem Rezept oder technischen Fehlern bleibt die Datenbank unverändert.
- Ein gespeichertes Rezept kann direkt zur Kochliste hinzugefügt werden und liefert korrekt skalierte Einkaufspositionen.

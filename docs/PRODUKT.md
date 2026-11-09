# Produktanforderungen

Stand: 9. November 2026 · Version 0.2.

## Hauptablauf

1. Die Startansicht bietet ausschließlich ein Rezeptlink-Feld und eine Importaktion.
2. Die App ruft die Rezeptseite ab und bevorzugt vorhandene `schema.org/Recipe`-Daten. Andernfalls verwendet sie sichtbaren Seitentext.
3. Die KI erkennt genau ein Rezept, formuliert es auf Deutsch und vereinheitlicht Maße und Temperaturen.
4. Ein vollständiges Rezept wird nach der Validierung direkt gespeichert. Kein obligatorischer Entwurf, keine zweite Bestätigung und keine manuelle Erfassung.
5. Die Sammlung wird angezeigt. Bearbeitung ist ausschließlich für nachträgliche Korrekturen erreichbar.

Dieser Ablauf ist in Version 0.2 implementiert. Textimport und manuelles Neuanlegen sind aus der Oberfläche und den API-Schreibpfaden entfernt.

## Fehler und Unsicherheit

- Fehlender API-Key: Einrichtung anzeigen; kein Quellen- oder KI-Aufruf.
- Blockierte Quelle oder fehlendes/vom Modell nicht vollständig erkanntes Rezept: verständlicher Fehler, keine Speicherung eines leeren Rezepts.
- Bekannter identischer Link: vorhandenen Datensatz verwenden, keine erneuten KI-Kosten.
- Gleichzeitige Importe desselben Links teilen einen Importvorgang innerhalb des laufenden Prozesses.
- Fehlende Zutatenmengen nicht erfinden, sondern `null` und einen Hinweis verwenden.
- Cups nur zutatenabhängig in Gramm umrechnen. Unsichere Dichte und Näherungswerte sichtbar machen.
- Fahrenheit in Celsius umrechnen, ohne eine nicht genannte Ofenart zu erfinden.
- Mengenbereiche und Alternativen erhalten, statt sie stillschweigend auf einen exakten Wert zu reduzieren.

## Sammlung und Einkaufsliste

Gespeicherte Rezepte sind nach Namen oder Zutaten durchsuchbar. Sie können angesehen, korrigiert, exportiert und gelöscht werden. Aus ausgewählten Gerichten mit gewünschter Portionenzahl wird eine gemeinsame Einkaufsliste deterministisch berechnet.

Identische Zutatennamen und kompatible Einheiten werden addiert. Produktvarianten, unterschiedliche Hinweise und unbekannte Mengen bleiben getrennt. Häkchen bleiben nach Neuladen erhalten und werden bei Plan- oder Rezeptänderungen zurückgesetzt, damit geänderte Mengen nicht als eingekauft erscheinen.

## Betrieb

- HTML/CSS/JavaScript im Browser, JavaScript auf Node.js 24 im Hintergrund.
- SQLite auf einem dauerhaften lokalen bzw. Hosting-Datenträger; kein externer Datenbank-Account.
- Lokaler Betrieb oder Hosting mit Node.js/Docker. Reines GitHub Pages reicht nicht.
- Bei Hosting bleibt der eigene Rechner ausgeschaltet. API-Aufrufe erfordern keine eigene KI-Hardware.
- Open-Source-Anwendung unter MIT. Optionaler externer KI-Dienst mit persönlichem API-Key und separater Verbrauchsabrechnung.
- Auf einem öffentlich gebundenen Server sind HTTPS-Domain und persönliches App-Passwort vorgeschrieben; kein Konto- oder Nutzerverwaltungssystem.

## Grenzen und spätere Funktionen

Instagram- und Videoimporte bleiben ausdrücklich zurückgestellt. Ein späterer Adapter kann Transkript und erkannte Einblendungen als `Source`-Inhalt an dieselbe Rezeptaufbereitung übergeben. Ein verlässlicher Abruf beliebiger Instagram-Videos wird nicht zugesichert.

Noch nicht enthalten: Browserausführung für JavaScript-only-Rezeptseiten, Synonymdatenbank für Zutaten, Packungsgrößen, Mehrbenutzerbetrieb, JSON-Reimport und eine providerabhängige Live-Veröffentlichung. Das tatsächliche Hosting wird eingerichtet, sobald der Anbieter feststeht.

## Abnahmekriterien

- Linkimport erzeugt mit eingerichtetem API-Key automatisch ein gespeichertes Rezept.
- Nach dem Import ist kein Bearbeitungsdialog geöffnet.
- Bei Fehlern bleibt die Sammlung unverändert.
- Bereits gespeicherte Links verursachen keinen zweiten KI-Aufruf.
- Eine nachträgliche Korrektur verändert den vorhandenen Datensatz.
- Portionsänderungen skalieren Einkaufsmengen und setzen Häkchen zurück.
- Passwort und API-Key werden nicht als Teil der Anwendung ausgeliefert.
- Tests führen keine echten KI-Aufrufe aus. Der Live-Import wird nach Einrichtung eines persönlichen Keys zusätzlich geprüft.

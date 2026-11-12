# Einkaufsliste

Die gemeinsame Liste ergänzt automatisch berechnete Rezeptzutaten um eigene Lebensmittel und Haushaltsartikel. Artikelname eingeben, bei Bedarf Vorschlag auswählen, optionale Menge wie „2 Flaschen“ angeben und mit + speichern. Pfeiltasten wählen einen Vorschlag, Enter übernimmt ihn, Escape schließt die Auswahl. Ohne Auswahl wird der freie Name gespeichert.

Ein lokal gepflegter Katalog mit Lebensmitteln und Haushaltsprodukten liefert bis zu sechs Vorschläge; eigene Einträge und Zutaten aus gespeicherten Rezepten werden einbezogen. Präfixe werden bevorzugt, Umlaute und Schreibvarianten wie „Spül“/„Spuel“ berücksichtigt. Das ist eine begrenzte Wortsuche ohne KI oder allgemeine Rechtschreibkorrektur. Ein bekannter Artikel erhält ein passendes Emoji und eine dezente Farbe; unbekannte Produkte 🛒. Es entstehen keine KI-Kosten, und Tippvorgänge verlassen den Browser nicht.

Ein Tippen auf die Kachel hakt den Artikel ab. Die letzten zwölf erledigten manuellen Artikel erscheinen unter „Zuletzt verwendet“ und können erneut hinzugefügt werden. Alle gespeicherten Einträge bleiben für Vorschläge berücksichtigt; nur die sichtbare Auswahl ist auf zwölf begrenzt. Mengen werden dabei wiederverwendet. Über ✎ bearbeiten, über × löschen. Gleiche normalisierte Namen werden bei erneutem Hinzufügen wieder geöffnet, nicht dupliziert. Eine neue Menge ersetzt die vorhandene; leer beim erneuten Hinzufügen behält die bisherige Menge. Beim Bearbeiten kann eine Menge bewusst geleert werden.

Alle aktiven Mitglieder dürfen die gemeinsame manuelle Liste verändern. Änderungen werden auf anderen Geräten nach Neuladen sichtbar; es gibt noch keine Live-Synchronisation oder Offline-Schreibwarteschlange für die produktive App. Gleichzeitige Änderungen verwenden den zuletzt gespeicherten Wert. Höchstens 500 Einträge inklusive erledigter Artikel; alte Einträge lassen sich entfernen. Keine automatische Bereinigung. Erledigte manuelle Artikel bleiben beim Ändern von Rezeptportionen erhalten. Rezeptzutaten werden weiterhin unabhängig skaliert und nach Änderung der Kochliste neu abgehakt. Freie Mengen und Rezeptmengen werden nicht automatisch miteinander addiert.

„Liste kopieren“ enthält offene manuelle Artikel und offene Rezeptzutaten. JSON-Rezeptexport enthält keine manuelle Einkaufsliste; vollständige Sicherung erfolgt über D1. Preview bleibt authentifiziert, schreibgeschützt und ohne Produktionsdaten; Offline-Demo simuliert alle Listenaktionen und setzt sie beim Neuladen zurück.

## Manueller Smoke-Test nach Freigabe

1. Backup und Migration 0004 bewusst freigeben, dann neue Version veröffentlichen.
2. Mit erlaubter E-Mail anmelden, Einkaufsliste öffnen und „Spül“ eingeben: „Spülmittel“ auswählen, „2 Flaschen“ speichern; 🧼-Kachel prüfen.
3. Zweites eingeladenes Mitglied lädt die Seite neu: derselbe Artikel ist sichtbar. Menge ändern, auf erstem Gerät neu laden und Änderung prüfen.
4. Abhaken, unter „Zuletzt verwendet“ erneut hinzufügen, bearbeiten und löschen; nach Neuladen Zustand prüfen.
5. Rezept auf Kochliste setzen, Portionen ändern: Zutaten skalieren; eigene Einkaufsartikel bleiben bestehen. „Liste kopieren“ prüfen.
6. Abgemeldet API-Schreibroute aufrufen: Zugang wird verweigert. Schreibgeschützte Preview darf weder Artikel speichern noch Produktionsdaten zeigen.
7. Smartphone mit 320 und 390 Pixel Breite prüfen: keine horizontale Überbreite, Vorschläge und Schaltflächen gut erreichbar.

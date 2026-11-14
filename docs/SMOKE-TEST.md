# Manueller Smoke-Test der privaten Futterluke

Automatisierte Tests verwenden ausschließlich lokales D1 und gemocktes OpenAI/Bring!. Die nachstehenden echten Aktionen werden vom Betreiber bewusst ausgeführt. Keine Secrets, Rohantworten oder Tokens in Screenshots/Chat/Logs teilen.

## Access und Rollen

- Nicht angemeldet: App, Rezeptbilder, JavaScript, Manifest und APIs sind geschützt.
- Freigegebene E-Mail: anmelden; konfigurierte einmonatige Sitzung bleibt wirksam.
- Nicht freigegebene E-Mail: kein Zugriff. Ungültiges Worker-Token: HTML-Anmeldehilfe bzw. API-JSON/401, ohne private Daten.
- Preview: Access aktiv, keine produktiven DB-/KI-/Bring!-Secrets; schreibgeschützt.
- Mitglied kann eigene Rezepte bearbeiten; Admin fremde verwalten/löschen und gemeinsame Bring!-Zielliste konfigurieren.

## Datenbank und Build

- Migrationen in der bestehenden D1 prüfen; der aktuelle Archivierungsstand benötigt keine neue Migration.
- Bestehende Rezepte bleiben lesbar. Historische Einkaufsdaten werden nicht gelöscht und fehlen in `/api/state`.
- Keine Einkaufsnavigation, Kochplanung, Produktkataloge oder Sammelversandschaltfläche.
- Alte `/shopping/`-URLs führen nach Anmeldung zum Kochbuch. Archiv-/Katalog-Assets und alte Einkaufs-APIs liefern 404.
- Futterluke bleibt mit unverändertem Zitronensymbol installierbar. Das alte Einkaufs-Home-Symbol kann manuell entfernt werden.
- GitHub Pages bleibt unabhängig und unverändert.

## Rezeptimport (nur nach Kostenfreigabe)

- Öffentliche strukturierte Rezeptseite importieren: direkt speichern, Titel/Portionen/Zeiten/Zutaten/Schritte prüfen.
- Mengen in Klammern in Arbeitsschritten; keine erfundenen Mengen oder Temperaturen.
- Große Seiten, optionale Bilder, fehlende Mengen, Quellfehler und sensible/private URLs prüfen.
- Identischer Link ohne Wunsch verursacht keinen erneuten KI-Aufruf; Anpassungswunsch erzeugt eine nachvollziehbare Variante.
- Öffentliche Videoquelle nur nach Zugriffsmöglichkeiten; kein Versprechen beliebiger YouTube-/Instagram-/TikTok-Downloads.
- OpenAI-Ausfall und Budget-/Rate-Limits liefern sichere Meldungen.

## Einzelne Bring!-Zutaten (bewusster externer Schreibtest, keine KI-Kosten)

- Als Admin Verbindung/ausgewählte Liste prüfen, ohne Secrets anzuzeigen.
- Ein gespeichertes Testrezept öffnen. Plus neben einer Zutat drücken; nur diese Zutat und gespeicherte Menge erscheinen in Bring!.
- Fehlende Menge bleibt „Menge offen“. Andere Zutaten werden nicht mitgesendet.
- Dieselbe Zutat binnen zehn Minuten erneut drücken: keine erneute Übertragung. Andere Zutat lässt sich danach übertragen.
- Mehrere unterschiedliche Plus-Schaltflächen zügig drücken: sie werden nacheinander gesendet. Nach einem Fehler keine automatische Schreibwiederholung.
- Veraltete Rezept-/Ziellistenrevision und unklare Bring!-Antwort kontrolliert abweisen. Bei unklarem Ergebnis vor neuem Versuch die Bring!-Liste prüfen.
- Testartikel bei Bedarf anschließend selbst in Bring! entfernen.

## Smartphone und Offline-Demo

- iPhone: Import, Sammlung, Suche, Rezeptansicht und einzelne Plus-Schaltflächen mit Tastatur prüfen; keine horizontalen Überläufe.
- `npm run build:demo`: portable Offline-Datei zeigt nur Rezeptoberfläche und simulierte einzelne Bring!-Übertragungen ohne Netz.
- Die reale Bring!-Liste wird durch die Demo niemals verändert.

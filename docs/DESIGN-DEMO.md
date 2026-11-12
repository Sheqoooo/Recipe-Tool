# Design und Vorschau ohne KI-Kosten

Die aktive Oberfläche in `web/` ist für Handys ausgelegt. Die Startseite enthält nur Marke, Rezeptlinkfeld mit Import-Schaltfläche und den Zugang zur Sammlung. Navigation, Einkaufsliste und Einstellungen erscheinen erst nach Verlassen der Startseite. Weißer Hintergrund, Systemschrift, kleine Pastellflächen und dekorative Lebensmittel-Emojis ersetzen die bisherige beige/grüne Gestaltung. Emojis sind keine vom Rezept bestätigten Kategorien.

Die Rezeptansicht orientiert sich strukturell an der vom Nutzer genannten [Forkful-Vorlage](https://template-forkful-recipe.bolt.host/recipe/banana-bread): Kopfbereich, Zeit-/Portionsangaben, Zutaten mit lokalen Abhakfeldern und nummerierte Zubereitungskarten. Desktop zeigt Zutaten und Zubereitung nebeneinander, Mobil untereinander. Externe Fotos, Fonts, Bewertungen, erfundene Kategorien und nicht implementierte Timer werden nicht eingebunden. Bilderfassung und Rezeptbilder gehören nicht zum bestehenden Datenmodell. Zutatenhäkchen in der Rezeptansicht sind eine lokale Zubereitungshilfe und verändern die gemeinsame Einkaufsliste nicht.

## Separate Offline-Demo

```sh
npm ci
npm run demo
```

Die Demo läuft ausschließlich auf `http://127.0.0.1:8788`. Sie benötigt weder Cloudflare-Anmeldung noch D1 oder OpenAI-Key. `npm run build:demo` baut alternativ nur die Dateien nach `.runtime/demo/`. Die Datei **`rezeptwerk-demo.html`** enthält CSS, JavaScript und Beispieldaten und kann direkt im Browser geöffnet werden. Der CI-Workflow stellt diese Dateien als Artefakt **design-demo** bereit. Sie sind keine produktive Veröffentlichung.

Beispielrezepte sind ausschließlich erfundene Demonstrationsdaten. Import, Bearbeitung, Suche, Kochliste, Portionsskalierung und Einkaufs-Häkchen werden im Browser simuliert. Die Demo ruft keine API auf, kann keine privaten Rezepte lesen und speichert Änderungen nur im Arbeitsspeicher dieses Tabs. Neuladen setzt sie zurück. YouTube-Import und Mitgliederverwaltung sind nicht simuliert und ausdrücklich nicht verfügbar. Die lokale Servervariante verhindert zusätzlich Netzwerkverbindungen über `connect-src 'none'`.

Der Schalter ist eine **Build-Konstante**, kein URL-Parameter oder öffentlicher Backend-Endpunkt. Der reguläre Build nach `dist/client/` enthält die Demo-Daten nicht. Eine produktive oder geschützte Cloudflare-Preview kann durch `?demo=1` nicht umgeschaltet werden. Die normalen Preview-Grenzen (Access, keine DB/Secrets, schreibgeschützt) bleiben bestehen. GitHub Pages unter `static/` bleibt unverändert.

## Mengen direkt an der Zubereitung

Der bestehende KI-Auftrag verlangt Mengen bereits im Schritttext. Die Oberfläche ergänzt zusätzlich bekannte Mengen referenzierter Zutaten im selben Anweisungstext, falls sie dort nicht erkennbar sind, z. B. `Paprikapulver hinzufügen. (Paprikapulver: 1 TL)`. Bereits vorhandene Angaben wie `Paprikapulver hinzufügen (1 TL)` werden nicht erneut angefügt, sofern Zutatenname und Menge im Text erkennbar sind. Dies ist eine einfache Anzeigeprüfung, keine sprachliche oder sachliche Validierung der KI-Aussage.

Wird dieselbe Zutat in mehreren Schritten referenziert, lässt sich deren Teilmenge nicht aus der Gesamtmenge ableiten. Dann bleibt der originale Schritttext maßgeblich und ein Zusatz kennzeichnet ausdrücklich die Rezeptgesamtmenge. Unbekannte Mengen bleiben unbekannt. Es findet keine automatische Verteilung oder Erfindung von Teilmengen statt. Die Rezeptansicht zeigt Originalportionen; abweichende Einkaufsportionen werden wie bisher in der Koch-/Einkaufsliste berechnet.

## Prüfung und Ausführungsgrenzen

Playwright prüft die reguläre Worker-Oberfläche und separat die portable Offline-Demo auf Desktop und Mobil: reduzierter Start, Sammlung, Rezeptansicht, Mengen, Suche, Einkaufsskalierung und keine HTTP-Anfragen aus der Offline-Demo. Ein zusätzlicher Test prüft, dass die Produktionsdatei keine Demo-Daten enthält. Screenshots liegen im Artefakt `worker-test-results`.

Auf dem ursprünglichen Codex-Rechner war Node nicht verfügbar. Ein lokaler Node-Server oder eine bereits laufende lokale Vorschau wird daher nicht behauptet; Build und Browserprüfung laufen im GitHub-CI-Rechner gegen lokale Emulation bzw. die lokale HTML-Datei. Die portable Demo kann nach dem Download ohne Node geöffnet werden. Produktiv-Deployment und Merge benötigen weiterhin eigene Freigabe; keine echten KI-Aufrufe für Designprüfungen.

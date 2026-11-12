# Design und Vorschau ohne KI-Kosten

Die aktive Oberfläche in `web/` ist für Handys ausgelegt. Die Startseite enthält nur Marke, Rezeptlinkfeld mit Import-Schaltfläche und den Zugang zur Sammlung. Navigation, Einkaufsliste und Einstellungen erscheinen erst nach Verlassen der Startseite. Weißer Hintergrund, Systemschrift, kleine Pastellflächen und dekorative Lebensmittel-Emojis ersetzen die bisherige beige/grüne Gestaltung. Emojis sind keine vom Rezept bestätigten Kategorien.

Die Rezeptansicht orientiert sich strukturell an der vom Nutzer genannten [Forkful-Vorlage](https://template-forkful-recipe.bolt.host/recipe/banana-bread): Kopfbereich, Zeit-/Portionsangaben, Zutaten mit lokalen Abhakfeldern und nummerierte Zubereitungskarten. Desktop zeigt Zutaten und Zubereitung nebeneinander, Mobil untereinander. Externe Fotos, Fonts, Bewertungen, erfundene Kategorien und nicht implementierte Timer werden nicht eingebunden. Bilderfassung und Rezeptbilder gehören nicht zum bestehenden Datenmodell. Zutatenhäkchen in der Rezeptansicht sind eine lokale Zubereitungshilfe und verändern die gemeinsame Einkaufsliste nicht.

## Separate Offline-Demo

```sh
npm ci
npm run demo
```

Die Demo läuft ausschließlich auf `http://127.0.0.1:8788`. Sie benötigt weder Cloudflare-Anmeldung noch D1 oder OpenAI-Key. `npm run build:demo` baut alternativ nur die Dateien nach `.runtime/demo/`. Die Datei **`rezeptwerk-demo.html`** enthält CSS, JavaScript und Beispieldaten und kann direkt im Browser geöffnet werden. Der CI-Workflow stellt diese Dateien als Artefakt **design-demo** bereit. Sie sind keine produktive Veröffentlichung.

Beispielrezepte sind ausschließlich erfundene Demonstrationsdaten. Import, Bearbeitung, Suche, Kochliste, Portionsskalierung und Einkaufs-Häkchen werden im Browser simuliert. Die Demo ruft keine API auf, kann keine privaten Rezepte lesen und speichert Änderungen nur im Arbeitsspeicher dieses Tabs. Neuladen setzt sie zurück. YouTube-Import und Mitgliederverwaltung sind nicht simuliert und ausdrücklich nicht verfügbar. Die Node-Servervariante (`npm run demo`) verhindert zusätzlich Netzwerkverbindungen über `connect-src 'none'`.

Der Schalter ist eine **Build-Konstante**, kein URL-Parameter oder öffentlicher Backend-Endpunkt. Der reguläre Build nach `dist/client/` enthält die Demo-Daten nicht. Eine produktive oder geschützte Cloudflare-Preview kann durch `?demo=1` nicht umgeschaltet werden. Die normalen Preview-Grenzen (Access, keine DB/Secrets, schreibgeschützt) bleiben bestehen. GitHub Pages unter `static/` bleibt unverändert.

## Mengen direkt an der Zubereitung

Neue Importe erhalten flüssige deutsche Anweisungen mit Mengen in Klammern direkt bei der Zutat: etwa `Paprikapulver (1 TL) hinzufügen. Danach den Reis dazugeben (200 g).` Die Oberfläche hängt keine Zutaten-Sammelklammer und keine hervorgehobene Mengenliste mehr an.

Bei bestehenden Rezepten wird eine bereits unmittelbar vor einem exakt passenden Zutatennamen stehende Mengenangabe nur für die Anzeige in Klammern dahinter verschoben. Andere Formulierungen, Flexionen und unklare Teilmengen bleiben unverändert; diese konservative Anzeigehilfe ist keine vollständige sprachliche Überarbeitung. Gespeicherte Rezepte werden nicht neu generiert oder verändert. Eine vollständige Neuformulierung älterer Rezepte erfordert eine spätere ausdrückliche Überarbeitung. Unbekannte Mengen bleiben unbekannt; Gesamtmengen werden niemals automatisch auf mehrere Schritte verteilt. Die Rezeptansicht zeigt Originalportionen.

## Prüfung und Ausführungsgrenzen

Playwright prüft die reguläre Worker-Oberfläche und separat die portable Offline-Demo auf Desktop und Mobil: reduzierter Start, Sammlung, Rezeptansicht, Mengen, Suche, Einkaufsskalierung und keine HTTP-Anfragen aus der Offline-Demo. Ein zusätzlicher Test prüft, dass die Produktionsdatei keine Demo-Daten enthält. Screenshots liegen im Artefakt `worker-test-results`.

Auf dem ursprünglichen Codex-Rechner war Node nicht verfügbar. Build und Browserprüfung laufen deshalb im GitHub-CI-Rechner gegen lokale Emulation bzw. die lokale HTML-Datei. Die dort erzeugten Demo-Dateien wurden für die visuelle Prüfung heruntergeladen. Für diesen Rechner kann alternativ ein reiner lokaler Python-Dateiserver ohne Backend gestartet werden: `python3 -m http.server 8788 --bind 127.0.0.1 --directory .runtime/demo`. Diese Alternative setzt den vorhandenen Demo-Build voraus und verwendet keine Worker- oder KI-Anbindung; die zusätzliche CSP der Node-Servervariante wird von Python nicht gesetzt. Die portable Demo kann nach dem Download ohne Node geöffnet werden. Produktiv-Deployment und Merge benötigen weiterhin eigene Freigabe; keine echten KI-Aufrufe für Designprüfungen.

Prüfnachweis des ersten Designstands: [CI-Lauf](https://github.com/Sheqoooo/Recipe-Tool/actions/runs/43231439981), Commit `bafaeed2be5e8c91b031441430c02160ea1aa2b7`: 97 Worker-/D1-/Geschäftslogiktests, sieben Konfigurationsprüfungen und zwölf Desktop-/Mobil-Browserprüfungen sowie beide Builds, Typen, lokale Migrationen und Dry-Runs erfolgreich. Screenshots von mobiler Startseite, Sammlung, Zubereitung und Desktop-Rezeptansicht wurden zusätzlich visuell geprüft. Keine kostenpflichtigen KI-Anfragen.

Die Oberfläche heißt nun Futterluke („Umwandlung von Rezepten“). Zitronenpasta hat eine selbst erstellte, eingebettete Demo-Illustration; andere Rezepte demonstrieren den Emoji-Fallback. Das ist kein aus einer fremden Rezeptseite importiertes Foto. Die Demo bleibt vollständig offline und erzeugt keine KI-Kosten.

Die Offline-Demo zeigt zusätzlich eigene Einkaufskacheln (unter anderem Oliven, Milch, Tofu und Spülmittel) und zuletzt verwendete Artikel. Vorschläge, Tastaturbedienung, Freitextmengen, Bearbeiten, Abhaken, Wiederverwenden und Entfernen funktionieren im Arbeitsspeicher. Neuladen setzt Demo-Einträge zurück; die echte App speichert sie in D1. Kein Netzwerkzugriff und keine KI-Kosten beim Tippen.

Neue Demo-Bedienung: Auf der Startseite direkt „Meine Rezepte“ oder „Meine Einkaufsliste“ öffnen. Ein Vorschlag wird sofort mit vorhandener Mengenangabe gespeichert; + bleibt für freien Text. Die Liste zeigt eigene Artikel und geplante Rezeptzutaten im selben Einkaufsweg. Im Rezept einzelne Zutaten per + oder alle über den Zutatenknopf kopieren. Die generierten PNG-App-Symbole werden beim Demo-Build unter `.runtime/demo/icons/` abgelegt; eine echte iOS-Installation wird nur über die geschützten Produktiv-Einstiege getestet, nicht über die portable Datei.

Die Vorschau enthält jetzt dieselben importierten Lebensmittelbegriffe wie die spätere produktive App. Beispielsweise Pastinake oder Karamellsirup suchen. Das Laden/Tippen verwendet keine OpenAI- oder externen Suchanfragen. Originalquellen und Lizenzen stehen unter dem Eingabefeld. Gespeicherte Demo-Artikel sind weiterhin nur synthetische Daten im Arbeitsspeicher.

Rezept- und Umrechnungshinweise stehen nach Zutaten, Zubereitung und Aktionen am Ende der Rezeptansicht. Sie bleiben vollständig erhalten, erscheinen aber als dezenter, kleiner Text statt als hervorgehobener Hinweisblock über den Zutaten. Fehler- und Importmeldungen außerhalb der Rezeptansicht bleiben unverändert.

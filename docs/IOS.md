# Auf dem iPhone zum Home-Bildschirm hinzufügen

Nach Freigabe und Veröffentlichung gibt es zwei separate Einstiege auf derselben privaten App:

- Kochbuch: `https://recipe-tool.sahin-erengil92.workers.dev/recipes/` — Name Futterluke, weißes Icon mit originalem Zitronensymbol.
- Einkauf: `https://recipe-tool.sahin-erengil92.workers.dev/shopping/` — Name Einkaufsliste, weißes Icon mit originalem Einkaufswagen.

Den gewünschten Link in Safari öffnen und anmelden. Teilen → Zum Home-Bildschirm → falls angezeigt „Als Web-App öffnen“ aktivieren → Hinzufügen. Für das zweite Symbol den anderen Link öffnen und wiederholen. Beide Bereiche arbeiten auf derselben Datenbank; Einkaufen benötigt weder Rezepte noch OpenAI-Key. Access-Anmeldung kann je gespeicherter Web-App erneut erforderlich sein.

Technik: eigene Web-App-Manifest-IDs und Start-URLs, Display standalone, Apple-Touch-Icons als PNG mit weißem Hintergrund. Originale vektorartige Motive werden durch `scripts/app-icons.mjs` ohne fremde Bilder, Emoji-Fonts oder externe Dienste reproduzierbar gerendert. Sie sind Emoji-ähnliche Symbole, keine Kopien von Apple-Emoji-Grafiken. iOS rundet die Ecken selbst. Die Installationsseiten nutzen dieselbe Oberfläche und dieselbe geschützte API.

Kein App Store, keine automatische Installation, keine Push-Nachrichten und kein produktiver Offline-Modus. Ein Symbol allein bietet keine Offline-Speicherung. Manifeste und Icons bleiben geschützt; falls Safari beim Installieren die Anmeldung nicht übernimmt, muss dies nach dem Test untersucht werden, ohne Assets eigenmächtig öffentlich zu machen. Browser-Metadaten und PNG-Dateien werden automatisiert geprüft; echter iOS-Gerätetest steht aus.

Quellen: [Apple: Web-App auf dem iPhone hinzufügen](https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios), [Apple: Web-Apps konfigurieren](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), [WebKit: getrennte Web-App-Identitäten](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Aktualisierung: gefüllte Einkaufstüte
Der Wagen wurde durch ein originales, gefülltes Tütensymbol ersetzt. Die normale Variante verwendet einen transparenten PNG-Hintergrund statt einer fest weißen Kachel; iOS kann seine Darstellung dadurch selbst zusammensetzen. Zusätzlich werden helle und dunkel hinterlegte PNGs generiert. Die Zitrone wird byte-identisch beibehalten.

Eine automatische Umschaltung bereits installierter Home-Symbole wird nicht behauptet: iOS verwaltet und speichert Web-Clip-Symbole, und es gibt keine hier verifizierte native Appearance-Asset-Schnittstelle für unsere Web-App. Falls die automatische Darstellung auf einem Gerät nicht passt, in Safari `/shopping/dark/` öffnen und das Symbol neu hinzufügen. Dieser Einstieg verwendet ausdrücklich dunkle Icon-Dateien, aber dieselbe Manifest-ID `/shopping/`, Startseite und Datenbank. Er bleibt auch bei hellem Systemdesign dunkel. In den Einstellungen der App ist der Link vorhanden.

Nach dem Update das bisherige Einkaufslisten-Home-Symbol entfernen und aus Safari neu hinzufügen, damit nicht der zwischengespeicherte Wagen verwendet wird. Die neue Icon-Datei hat einen neuen Dateinamen. Die Anwendung selbst bleibt im bisherigen hellen Design. Echter iOS-Test von automatischer Darstellung und Home-Symbolcache steht aus; der dunkle Installationsweg und PNG-Dateien werden automatisiert geprüft.

Referenzen: [WebKit: Manifest- und Apple-Touch-Icons](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple-Entwicklerforum: PWA-Dunkelmodus-Symbole](https://developer.apple.com/forums/thread/761615), [W3C: Manifest-Farbthemen betreffen Theme-/Hintergrundfarben](https://www.w3.org/TR/appmanifest/#color_scheme_dark-member).

Der ausdrücklich dunkle Installationsweg startet dauerhaft unter /shopping/dark/, damit beim erneuten Öffnen dieselben dunklen Installationsmetadaten geladen werden. Die App-ID bleibt /shopping/.

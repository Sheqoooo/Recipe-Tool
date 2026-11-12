# Auf dem iPhone zum Home-Bildschirm hinzufügen

Nach Freigabe und Veröffentlichung gibt es zwei separate Einstiege auf derselben privaten App:

- Kochbuch: `https://recipe-tool.sahin-erengil92.workers.dev/recipes/` — Name Futterluke, weißes Icon mit originalem Zitronensymbol.
- Einkauf: `https://recipe-tool.sahin-erengil92.workers.dev/shopping/` — Name Einkaufsliste, weißes Icon mit originalem Einkaufswagen.

Den gewünschten Link in Safari öffnen und anmelden. Teilen → Zum Home-Bildschirm → falls angezeigt „Als Web-App öffnen“ aktivieren → Hinzufügen. Für das zweite Symbol den anderen Link öffnen und wiederholen. Beide Bereiche arbeiten auf derselben Datenbank; Einkaufen benötigt weder Rezepte noch OpenAI-Key. Access-Anmeldung kann je gespeicherter Web-App erneut erforderlich sein.

Technik: eigene Web-App-Manifest-IDs und Start-URLs, Display standalone, Apple-Touch-Icons als PNG mit weißem Hintergrund. Originale vektorartige Motive werden durch `scripts/app-icons.mjs` ohne fremde Bilder, Emoji-Fonts oder externe Dienste reproduzierbar gerendert. Sie sind Emoji-ähnliche Symbole, keine Kopien von Apple-Emoji-Grafiken. iOS rundet die Ecken selbst. Die Installationsseiten nutzen dieselbe Oberfläche und dieselbe geschützte API.

Kein App Store, keine automatische Installation, keine Push-Nachrichten und kein produktiver Offline-Modus. Ein Symbol allein bietet keine Offline-Speicherung. Manifeste und Icons bleiben geschützt; falls Safari beim Installieren die Anmeldung nicht übernimmt, muss dies nach dem Test untersucht werden, ohne Assets eigenmächtig öffentlich zu machen. Browser-Metadaten und PNG-Dateien werden automatisiert geprüft; echter iOS-Gerätetest steht aus.

Quellen: [Apple: Web-App auf dem iPhone hinzufügen](https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios), [Apple: Web-Apps konfigurieren](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), [WebKit: getrennte Web-App-Identitäten](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

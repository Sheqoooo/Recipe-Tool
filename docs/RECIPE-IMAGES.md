# Rezeptbilder

Neue Webseitenimporte bevorzugen `schema.org/Recipe.image` (URL, Liste oder ImageObject), danach `og:image` / `twitter:image`. Relative Pfade beziehen sich auf die tatsächlich abgerufene Seite. Vorhandene Bildnachweise wie creditText oder Urhebername werden übernommen; andernfalls wird nur die Rezeptseite als Bildquelle verlinkt. Keine erfundenen Urheberangaben, keine KI-Bilder und keine beliebigen Profilbilder aus dem HTML.

Ein Kandidat wird nach erfolgreicher Rezeptgenerierung begrenzt abgerufen. Unzugängliche, signierte, zu große oder ungeeignete Bilder werden übersprungen; das Rezept bleibt erhalten. Unterstützt: JPEG, PNG, WebP, 32–8192 Pixel je Seite, höchstens 16 Megapixel und 1 MiB. Keine automatische Nachpflege vorhandener Rezepte, keine YouTube-Bildanalyse. Bildrechte bleiben beim Rechteinhaber.

Die Bytes werden in der vorhandenen D1 gespeichert. Cloudflare erlaubt bis zu 2 MB pro BLOB/Zeile; unser Limit liegt darunter ([D1-Limits](https://developers.cloudflare.com/d1/platform/limits/)). Sammlung und JSON-Export enthalten nur die geschützte Bildroute sowie Quellen-/Nachweismetadaten. Der vollständige D1-Export umfasst auch Bilder.

## Manueller Smoke-Test nach ausdrücklicher Freigabe

1. Backup prüfen, Migration 0003 bewusst freigeben und anwenden; danach neue Version veröffentlichen.
2. Rezeptseite mit Recipe.image importieren: Foto in Sammlung und Detail, korrekte Quellseite und vorhandener Bildnachweis.
3. Seite ohne Bild und mit nicht erreichbarem Bild importieren: Rezept wird gespeichert, Emoji bleibt.
4. Rezept nach dem Import mehrfach öffnen: keine weitere KI-Anfrage und kein Abruf beim fremden Bildanbieter durch den Browser.
5. Abgemeldet direkte `/api/recipes/<id>/image` öffnen: Access muss Zugriff verhindern. Geschützte Preview bleibt ohne Produktionsbilder/D1.
6. Gespeichertes Rezept bearbeiten: Bild bleibt. Als Admin löschen: Bilddatensatz wird mitgelöscht.
7. Auf Smartphone Layout und Bildausfall-Fallback prüfen. JSON-Export ist kein vollständiges Bildbackup.

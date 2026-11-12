# Einkaufsweg und mögliche Produktdatenquellen

Recherche: 12. November 2026. Es gibt keinen universellen Filialplan. Kaufland beschreibt einen Einstieg über Obst/Gemüse und Backwaren; weitere Abteilungen folgen mit örtlichen Abweichungen. Das staatliche österreichische Gesundheitsportal empfiehlt Tiefkühlware eher am Ende des Einkaufs. Unser Weg ist eine daraus abgeleitete Produktentscheidung, keine behauptete Norm für alle Supermärkte.

Standardfolge: Obst/Gemüse → Backwaren → Vorrat/Konserven → Getränke → Haushalt/Drogerie → unklare Artikel → Milch/Eier/Kühlregal → Fleisch/Fisch → Tiefkühlkost. Innerhalb einer Gruppe alphabetisch. Unbekannte Artikel werden als Zuordnung offen gekennzeichnet. Die generischen Regeln kennen keine konkrete Filiale; Milch kann beispielsweise haltbar oder gekühlt angeboten werden. Explizite Angaben wie TK, Dose oder getrocknet übersteuern die frische Grundzutat. Später können Filialprofile oder manuelle Kategoriekorrekturen ergänzt werden; aktuell existieren sie noch nicht.

Quellen: [Kaufland: Aufbau einer Filiale](https://unternehmen.kaufland.de/presse/kaufland-corporate-blog/stimmt-es-eigentlich-dass-man-im-supermarkt-immer-gegen-den-uhrzeigersinn-laeuft), [Gesundheitsportal Österreich: Einkauf](https://www.gesundheit.gv.at/leben/ernaehrung/lebensmittel/einkauf.html).

## Seriöse Datenquellen

**Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut:** Allgemeine Lebensmittel mit Kategorien und Nährstoffdaten. Die offizielle Downloadseite bietet Open Data unter CC BY 4.0 mit Namensnennung des Instituts. Als Ausgangspunkt für einen größeren deutschen Begriffskatalog geeignet; zubereitete Lebensmittel müssten für eine Einkaufssuche bereinigt und ähnliche Namen zusammengeführt werden. Es handelt sich nicht um das vollständige Sortiment einer konkreten Filiale und nicht um einen Haushaltswarenkatalog. [Offizieller Download und Lizenzhinweis](https://blsdb.de/download), [FAQ](https://www.blsdb.de/faq).

**Open Food Facts:** Gemeinschaftlich gepflegte Produktdatenbank, für Markenartikel und Barcodes interessant. Datenbank unter ODbL, Bilder mit eigener Lizenz; Veröffentlichung und Zusammenführung von Daten müssen anhand der offiziellen Nutzungsbedingungen geprüft werden. Keine amtliche Vollständigkeitsgarantie oder Qualitätsprüfung aller Angaben. [Offizielle Lizenzdokumentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/), [Projekt und Datenbeschreibung](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/index.md).

Der zuvor vorgeschlagene Import ist inzwischen umgesetzt; aktueller Stand siehe unten. Haushaltsartikel werden weiterhin separat gepflegt.\n
## Implementierter Import, 12. November 2026
Der oben beschriebene nächste Ausbauschritt wurde umgesetzt: 3.425 ausgewählte BLS-Einträge und 1.911 deutschsprachige Einträge der OFF-Zutatentaxonomie, daraus 5.160 unterschiedliche Suchnamen. Haushaltsartikel bleiben zusätzlich im eigenen Katalog. Keine Millionen Markenpackungen, Bilder oder Barcode-Dumps. 

Reproduzierbarer Import, Quellen/Hashes und Lizenzen: [Katalogbeschreibung](../data/catalog/README.md), [Lizenzhinweise](../data/catalog/LICENSE.md). Rohbezeichnungen bleiben im BLS-Auszug erhalten. Der Suchkatalog ist ein Ausschnitt, nicht vollständig, und Abteilungen sind angenähert. Beide Quellen werden in der Einkaufsliste verlinkt. Build/Deployment lädt keine Quellen automatisch herunter.

# Bestandsaufnahme und Migrationsentscheidungen

Stand 2026-11-09. Ausgangscommit: `a1dcd3929985ae3613358f22ff655fe88064383f`. Öffentliche GitHub-Issues: bei der Prüfung keine offenen Einträge. Keine bestehende Wrangler-/D1-/Access-Konfiguration im Repository.

## Vorhanden

| Bereich | Bestandsbefund | Entscheidung |
| --- | --- | --- |
| Oberfläche | HTML/CSS/Vanilla-JavaScript; responsive Sammlung, Korrektur, Kochliste, Einkaufsliste | Gestaltung erhalten; aktive App nach TypeScript portieren, kein neues UI-Framework |
| Rezeptimport | schema.org bevorzugt, sichtbarer Text als Fallback | Extraktion übernehmen; Workers-Fetch statt Node-Sockets |
| KI | Chat Completions, JSON-Schema, fester Modellname, Mocktests | Eigenständiges Responses-SDK-Modul, gemeinsame Schema-/Typdefinition, Verbrauchserfassung |
| Datenbank | `node:sqlite`, JSON-Dokumente, Dateisystem-Settings | Relationale D1-Tabellen und versionierte SQL-Migrationen |
| Mengen | g/kg, ml/l, Zutatenaggregation und Portionsskalierung | Als TypeScript-Geschäftslogik erhalten und testen |
| Sicherheit | Basic-Passwort, prozessweiter Token, in-memory Parallelitätslimit | Access-JWT + Mitgliedschaften/Rollen, Same-Origin-Schreibschutz, D1-Limits |
| Datenaufbewahrung | Vollständiger Quelltext dauerhaft gespeichert | Nur Rezept und knappe Importmetadaten; Quelldaten nur während Verarbeitung |
| Hosting | Node/Docker-Konfiguration; keine Cloudflare-Konfiguration | Workers Static Assets, bestehende D1 und Workers Builds vorbereiten |
| Pages | Öffentliche, API-freie statische Vorschau | Unverändert erhalten; kein Zugriff auf private Worker-Daten |
| Tests | 29 Node-Tests und Desktop-/Mobilbrowserabläufe; KI simuliert | Entsprechende Worker-/D1-/JWT-/Berechtigungs- und Browsertests |

## Offene funktionale Lücken im Ausgangsstand

Keine individuellen Nutzer oder Rollen; keine Vorbereitungs-/Kochzeiten; fehlende Angaben teilweise mit 2 Portionen vorbelegt; keine Zutatenzuordnung zu Schritten; keine dauerhaften Tages-/Monatskostenlimits oder Importhistorie; keine Videoverarbeitung. Quell- und Key-Rohdaten liegen in lokalen Dateien. Der lokale Git-Ordner hat noch keine Commits; der veröffentlichte Quellstand wurde über die GitHub-Verbindung abgeglichen.

## Zielstruktur und Phasen

1. `src/shared`: feste Schema-/TypeScript-Verträge, Validierung und Mengenlogik.
2. `src/worker`: Access-Authentifizierung, D1-Repository, Importkoordination, Web-/Transkriptadapter und OpenAI-SDK.
3. `web`: übernommene Gestaltung mit typisierter Anwendung. `static` bleibt die existierende öffentliche Pages-Vorschau.
4. `migrations`: ausschließlich additive, geprüfte D1-Migrationen; keine produktiven Datenimporte aus der alten privaten Datei ohne gesonderte Zustimmung.
5. Standard-Wrangler-Konfiguration ausschließlich lokal. Separate produktive Konfigurationsvorlage mit bestehender DB-ID als Platzhalter. Preview-Konfiguration ohne D1 und ohne OpenAI-Secret.

## Konservative Entscheidungen

- Eine gemeinsame Sammlung; keine Mandantenstruktur. Kochliste und Häkchen gelten gemeinsam; jede Änderung invalidiert vorherige Häkchen.
- Vorbereitungs-/Kochzeit und Portionen dürfen unbekannt (`null`) sein. Bei unbekannten Portionen ist Skalierung gesperrt, bis ein Eigentümer/Admin die Zahl korrigiert.
- Schritte enthalten Text mit Mengen und Referenzen auf Zutatenpositionen. Fehlende Referenzen/fragliche Mengen werden markiert, niemals erfunden.
- Mitglieder werden nach überprüfter Access-Identität explizit in D1 zugelassen; Access-Login allein ist keine Mitgliedschaft. Erste Admins werden nur über konfigurierte Bootstrap-E-Mail-Adressen zugelassen.
- Auf ausdrücklichen Nutzerwunsch öffentliche Rezeptquellen ohne vorherige Domainfreigabe. Eine optionale Hostliste kann weiter einschränken. HTTPS, öffentliche DNS-Antworten und jedes Redirect-Ziel prüfen; private Adressen und lokale Namensräume sperren. Workers-Fetch mit global_fetch_strictly_public und ohne private Netzwerk-/Service-Bindings; Cloudflares öffentliche Netzwerkisolation bleibt eine dokumentierte Vertrauensannahme.
- D1 reserviert Anfragekontingent und konservatives Kostenbudget atomar vor dem Abruf. Fehlgeschlagene/unklare Anfragen behalten ihre Reservierung; keine automatischen kostenpflichtigen Retries.
- YouTube-Link wird erkannt und mit `TRANSCRIPT_REQUIRED` beantwortet. Autorisiert bereitgestellte Transkripte sind der implementierte Alternativpfad; kein allgemeiner Video-/Untertitel-Downloader. Audio-/Frame-Adapter bleiben ausdrücklich ein späterer Schritt.
- Der Betreiber muss die vorhandene D1-Zuordnung prüfen und Access-Aussteller/Audience sowie die kostenlose workers.dev-Adresse konfigurieren; eine eigene Domain ist nicht erforderlich. Keine Ressourcen werden durch diese Migration erstellt oder veröffentlicht.

Prüfgrundlagen und aktuelle Video-/API-Grenzen: [OPENAI-VIDEO.md](OPENAI-VIDEO.md). Deployment- und Sicherheitsentscheidungen: [DEPLOYMENT.md](../DEPLOYMENT.md), [SECURITY.md](../SECURITY.md).

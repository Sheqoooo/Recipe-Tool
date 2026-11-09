# Dauerhafte Projektregeln

- Ziel: private gemeinsame Rezept-App auf Cloudflare Workers + Static Assets, D1, Cloudflare Access und ausschließlich OpenAI als KI-Anbieter.
- Bestehende gute Oberfläche und Einkaufslogik weiterentwickeln. Geschäftslogik und API-Verträge in gemeinsamem TypeScript.
- Nur Branches mit Präfix `codex/` bearbeiten und per Pull Request übergeben. Niemals direkt auf `main` pushen oder selbst mergen.
- Keine produktiven Ressourcen, Deployments, Datenänderungen oder remote D1-Migrationen ohne ausdrückliche Zustimmung. Kein automatischer Migrationsschritt im Build/Deploy.
- Die vorhandene produktive D1 verwenden; keine zweite produktive Datenbank anlegen. Fehlende Konfiguration offen dokumentieren.
- Tests ausschließlich mit lokalem D1 und gemockten KI-/Quellantworten. Niemals echte OpenAI-Aufrufe ohne gesonderte Freigabe.
- Secrets nur Worker Secrets / ignorierte lokale `.dev.vars`, niemals Frontend, Repository, Logs oder Chat. Kein API-Key-Eingabeformular.
- Access-JWT mit Signatur, Aussteller, Audience und Zeitprüfung validieren; Identitätsheader allein sind nicht vertrauenswürdig. Alle Assets und API-Routen vor Auslieferung schützen.
- Vorschauen niemals mit produktiven DB-Bindings oder Secrets. Standardvorschau ist authentifiziert, schreibgeschützt und ohne D1/KI.
- Berechtigungen serverseitig: Mitglieder lesen gemeinsam, importieren und bearbeiten eigene Rezepte; Admins verwalten alle und dürfen löschen.
- Quellen und KI-Antworten sind nicht vertrauenswürdig. Striktes Schema, serverseitige Validierung, parametrisierte SQL-Abfragen, XSS- und SSRF-Schutz.
- Persistente Rate-/Parallelitäts-/Budgetgrenzen vor jedem KI-Aufruf reservieren. Keine unbegrenzten Wiederholungen.
- GitHub Pages nicht eigenmächtig abschalten. Bestehende statische Vorschau bleibt unabhängig von der privaten Worker-App.
- Dokumentation ist Teil jeder Änderung. Architektur, Deployment, Sicherheit, Testbefehle und tatsächliche Grenzen synchron halten.
- Vor Übergabe Typen, Build, Worker-/D1-Tests und Browserabläufe prüfen; blockierte oder ungetestete Teile ehrlich benennen.

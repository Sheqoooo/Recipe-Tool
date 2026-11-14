# Archiv: interne Einkaufsliste

Eingefrorener Stand vom 14.11.2026 aus Commit [d9589a0698b99d17dc1bb555980a2f9bc9911c53](https://github.com/Sheqoooo/Recipe-Tool/tree/d9589a0698b99d17dc1bb555980a2f9bc9911c53).

Dieses Verzeichnis bewahrt die frühere interne Einkaufsliste einschließlich Kochplanung, Kacheln, Suchvorschlägen/Emojis, mobilem Eingabedock, Katalogdaten samt Lizenzen, Datenbankzugriffen, Frontend, Build-Einstiegen und Tests. Gemeinsame Rezeptdateien wurden mitgesichert, damit sich der damalige Zusammenhang nachvollziehen lässt. Die damalige Hauptanleitung heißt `BASELINE_README.md`.

**Kein aktiver App-Code:** Weder Worker-/Browser-Einstiege noch Build-/Testkonfiguration importieren dieses Verzeichnis. Es wird nicht nach `dist/client` kopiert. Die aktive App bietet ausschließlich einzelne Bring!-Übertragungen statt der alten Einkaufsliste.

## Später wiederverwenden

In einem separaten Entwicklungsbranch den gewünschten archivierten Teil prüfen und gezielt integrieren. Relative Pfade im Snapshot entsprechen dem damaligen Projekt; ein isolierter Wiederherstellungstest benötigt die gesicherten Package-/Wrangler-/TypeScript-Dateien und historische Migrationen aus dem Baseline-Commit. Niemals aus dem Archiv produktiv deployen oder alte Tabellen zurücksetzen. Echte Secrets und gespeicherte Rezepte/Einkaufsdaten sind nicht Teil dieses Archivs.

Die produktive Datenbank behält die historischen Einkaufstabellen. Diese Änderung führt keine Datenmigration oder Löschung aus. Die Kataloglizenzen und Quellen sind unter `data/catalog/` mitarchiviert.

GitHub Pages bleibt vom privaten Worker-Frontend unabhängig und wurde nicht geändert.

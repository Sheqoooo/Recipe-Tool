# Produktstand Version 0.3

- Gemeinsame private Sammlung für eingeladene Access-Nutzer.
- Linkimport mit schema.org-Fallback und strukturierter deutscher Rezeptgenerierung.
- Unbekannte Portionen, Mengen und Zeiten bleiben unbekannt; bekannte Mengen erscheinen auch direkt bei referenzierten Arbeitsschritten.
- Direktes Speichern ohne obligatorische Korrekturmaske.
- Mitglieder bearbeiten eigene Rezepte; Admins bearbeiten/löschen alle und verwalten die Mitgliederliste.
- Gemeinsame Kochliste und deterministisch skalierte Einkaufsliste; Häkchen werden bei Änderungen zurückgesetzt.
- Kosten-/Anfragekontingente, Importstatus und Verbrauchsschätzungen im Backend.
- Rechtmäßig bereitgestellte YouTube-Transkripte als ausdrücklich begrenzter Alternativpfad.

Nicht enthalten: allgemeiner YouTube-Download, Audio-/Video-/Frameuploads, automatische Bildanalyse, JSON-Reimport, Tags/Favoriten und automatische Zutaten-Synonyme. Sachliche KI-Angaben müssen bei Unsicherheit korrigiert werden können.

Die Implementierung wird per PR geprüft. Produktive Bereitstellung, echte KI-Tests und Remote-Migrationen sind nicht freigegeben. Aufbau und Grenzen: [ARCHITECTURE.md](../ARCHITECTURE.md), [OPENAI-VIDEO.md](OPENAI-VIDEO.md).

# Catalog data licences

Application source code remains MIT-licensed. The data in this directory has separate licences.

- `bls.json`: derived from Max Rubner-Institut (2025), Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Source: https://blsdb.de/download . Licensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Changes: shopping-oriented selection, raw-state suffix removal, simple alternative names and approximate department mapping. Original labels and BLS identifiers are retained.
- `open-food-facts.json`: contains information from Open Food Facts contributors, made available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/ . Source ingredient taxonomy and pinned commit are recorded in SOURCES.json. Changes: German shopping-oriented subset, synonyms, simplified identifiers and department mapping. This derived dataset is offered under ODbL 1.0; individual contents retain the applicable Database Contents License: https://opendatacommons.org/licenses/dbcl/1-0/ . No product images or packaging graphics are included.
- `search.json`: combined, deduplicated search projection of both datasets, offered under ODbL 1.0. BLS contents retain their CC BY 4.0 attribution. Both origin datasets and the complete transformation script are published in this repository at no charge.

The licences do not replace one another and do not cover private recipes, shopping entries or account data. Those user records are never part of these snapshots. No warranty is made concerning completeness, food composition or availability in any shop. Departments are app heuristics, not source guarantees.

Provenance, source hashes and entry counts: SOURCES.json. Reproduction: README.md and ../../scripts/import-product-data.py.

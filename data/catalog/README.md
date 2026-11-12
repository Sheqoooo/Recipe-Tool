# Imported shopping catalog

This directory contains public source-derived food names only. No user records, API keys or raw source archives.

- BLS 4.0: 3,425 selected entries, with original names and source identifiers.
- Open Food Facts: 1,889 German ingredient-taxonomy entries and aliases.
- Search projection: 5,138 unique names, plus the app's separately maintained household/common-product list.

These are generic ingredient names, not a download of all branded supermarket products. BLS cooked preparations, recipe groups and many excessively long records are excluded. OFF entries require a recognized food ancestor and a usable German name; technical additives and extract/protein/aroma names are conservatively filtered. Results are not exhaustive. Storage form can affect department assignment; classifications are approximate. Emoji matching is deterministic and may use a category emoji.

The exact source versions, hashes, publishers, licences and original URLs are in SOURCES.json; licence notices are in LICENSE.md. The application displays links to both publishers and licences. Public machine-readable snapshots and the transformation code are available in the GitHub repository. Authenticated production assets also contain `/catalog/` copies.

Rebuild from official, independently downloaded files (no automatic network access or production operations):

```
python3 scripts/import-product-data.py --bls /path/to/BLS_4_0_2025_DE.zip --off /path/to/ingredients.txt --off-commit 7fbee094fb9d89e98c49ab4b2102c7b48b1a7a05
```

The OFF source file is `taxonomies/food/ingredients.txt` at the pinned commit. The BLS download is linked at https://blsdb.de/download . Do not commit either raw archive, local databases or credentials. The importer uses Python's standard library, validates input/output sizes and never calls an AI API. Re-running it with the same source files must produce the same JSON files.

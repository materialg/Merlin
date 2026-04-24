# data/

Static reference data bundled into the Merlin server-side pipeline.

## pdl/

PDL canonical taxonomy and person schema snapshot. See [`pdl/README.md`](pdl/README.md).

## zip_coords.json

`{ "<5-digit-zip>": { "lat": <number>, "lng": <number> } }` — 33,144 US ZIP centroids.

**Source:** [Erik Hurst — US Zip Codes from 2013 Government Data](https://gist.github.com/erichurst/7882666) (derived from US Census 2013 public-domain ZCTA centroids).

**Licence:** Public domain (US Census source data is not copyrightable).

**Used by:** `lib/zipLookup.ts` → `getCoordsFromZip(zip)`, consumed by `lib/pdlQueryBuilder.ts` to construct PDL `geo_distance` filters.

**Refreshing:** The US Census Bureau publishes an updated ZCTA gazetteer annually at <https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html>. Re-fetch the national ZCTA file, parse ZIP/lat/lng columns, and overwrite this file. Do not bloat the schema — server-cold-start parse time scales with size.

**Coverage notes:** Covers USPS ZIP Code Tabulation Areas (ZCTA). Does not include PO Box–only ZIPs or ZIPs created after 2013. If a query's postal_code lookup returns `null`, `pdlQueryBuilder` falls back to exact-match on `location_postal_code` rather than silently dropping the location filter.

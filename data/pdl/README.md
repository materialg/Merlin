# PDL reference data

Canonical taxonomy and schema snapshots from [People Data Labs](https://peopledatalabs.com) for use by the search orchestrator and Gemini prompt builder.

**This is reference data.** No business logic lives here — these files are read-only inputs consumed by code elsewhere in the repo.

## Files

| File | Contents | Count |
|---|---|---|
| `roles.json` | Top-level `job_title_role` enum values | 24 |
| `sub_roles.json` | `job_title_sub_role` enum values | 104 |
| `levels.json` | `job_title_levels` enum values | 10 |
| `classes.json` | `job_title_class` enum values | 5 |
| `role_to_sub_roles.json` | Parent role → child sub-roles mapping | 24 roles |
| `person_fields.json` | Person schema fields with `{field_name, type, description, category, search_relevant?}` | ~90 fields |

`person_fields.json` marks search-relevant fields with `"search_relevant": true` — these are the ones the orchestrator and prompt builder should reach for first.

## Sources

The four enum files come from the public PDL schema S3 bucket (authoritative):

- `roles.json` ← `https://pdl-prod-schema.s3.us-west-2.amazonaws.com/30.0/enums/job_title_role.txt`
- `sub_roles.json` ← `https://pdl-prod-schema.s3.us-west-2.amazonaws.com/30.0/enums/job_title_sub_role.txt`
- `levels.json` ← `https://pdl-prod-schema.s3.us-west-2.amazonaws.com/30.0/enums/job_title_levels.txt`
- `classes.json` ← `https://pdl-prod-schema.s3.us-west-2.amazonaws.com/30.0/enums/job_title_class.txt`

The mapping and person schema were extracted from the docs:

- `role_to_sub_roles.json` ← https://docs.peopledatalabs.com/docs/title-subroles-to-roles
- `person_fields.json` ← https://docs.peopledatalabs.com/docs/fields

## Version

**Taxonomy version: 30.0** (latest on the S3 bucket as of ingest).

Note: the PDL docs pages reference a mix of v28.0 / v29.1 / v30.0 at any given time — the raw S3 enums at `/30.0/` were used as the source of truth. If PDL announces a newer version, swap the path segment and re-run the refresh.

## Ingested

**2026-04-23**

## Refreshing

Run quarterly, or whenever PDL announces a version bump.

1. Find the latest version by listing `https://pdl-prod-schema.s3.us-west-2.amazonaws.com/` — look for a numbered prefix (e.g. `31.0/`).
2. Re-download the four enum files from `/<version>/enums/*.txt` and replace the contents of `roles.json`, `sub_roles.json`, `levels.json`, `classes.json` (preserve JSON-array format: sorted, one entry per element).
3. Re-read https://docs.peopledatalabs.com/docs/title-subroles-to-roles and https://docs.peopledatalabs.com/docs/fields and update `role_to_sub_roles.json` and `person_fields.json` for any added/removed fields or mapping changes.
4. Bump the **Taxonomy version** and **Ingested** fields in this README.
5. Commit as a single changeset — downstream prompts read these files at request time and will pick up the new taxonomy automatically.

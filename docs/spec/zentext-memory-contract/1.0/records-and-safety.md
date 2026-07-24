# Canonical records and safety

## Canonical store

The current canonical store is a project-scoped SQLite database under:

```text
~/.zentext/projects/<project-id>/store.sqlite
```

Project identity is derived from the normalized Git origin when present.
Without a Git origin, identity is derived from the canonical absolute path and
is therefore not portable across a path change.

## Record envelope

Every stored record has generated envelope fields including:

- `id`;
- `project`;
- `type`;
- `title`;
- `status`;
- `created_at`;
- `updated_at`;
- `revision`;
- `author`;
- `tags`;
- `refs`;
- `schema_version`; and
- supersession fields where applicable.

Type-specific payload fields are validated separately. Current record types are
task, decision, blocker, handoff, log, validation, policy, and custom.

Generated identity, timestamps, revision, project, and schema fields cannot be
supplied as ordinary create input. Immutable fields cannot be changed through
an update.

## Schema versioning

Stored records currently use `schema_version: 1`. The SQLite database has its
own ordered migration version. A reader must not infer record compatibility
solely from the database migration number.

Unknown incompatible schema versions require an explicit migration or typed
rejection. A producer must not silently coerce an incompatible record and call
it current.

## Provenance

Externally meaningful records may carry:

- source environment;
- capture time;
- project ID;
- task ID and task revision;
- files inspected;
- commands executed;
- verification performed;
- parent record;
- parent handoff; and
- whether an explicit secret-detector override was used.

Provenance is evidence about origin, not proof that the originating tool's
claim is true. Verification remains explicit.

## Validation and sanitization

External input is checked for:

- required and unknown fields;
- enums and array shapes;
- maximum lengths and payload size;
- timestamps, IDs, and revisions;
- malformed Unicode;
- null and control characters;
- terminal escape sequences;
- absolute and traversal file paths; and
- non-JSON/binary-like input.

Unsafe input is rejected with a typed error. Canonical records must not depend
on terminal cleanup after persistence.

## Secret boundary

Likely API keys, access tokens, private keys, passwords, connection strings,
and environment secrets are detected before persistence. A local caller may
use an explicit override for a known false positive; the override is recorded
in provenance.

Every returned view is redacted even after an override. Redaction is not
encryption and is not a license to store credentials. Secret values, local
databases, environment files, and credentials must not be committed or included
in portable evidence.

## Implementation references

- `src/types/records.ts`
- `src/schemas.ts`
- `src/safety.ts`
- `src/store/migrations.ts`
- `src/store/sqlite-store.ts`
- `tests/safety-schemas.test.ts`
- `tests/store.test.ts`

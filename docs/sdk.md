# TypeScript SDK

The TypeScript SDK exposes typed project-memory behavior without parsing
terminal text.

```ts
import { openProject } from "zentext";

const project = await openProject({ cwd: process.cwd() });
try {
  const continuation = await project.getContinuation();
  console.log(continuation.task.title);
  console.log(continuation.handoff.next_action);
} finally {
  project.close();
}
```

Top-level helpers are also exported:

- `openProject`
- `getContinuation`
- `getActiveTask`
- `validateHandoff`
- `recordProgress`
- `updateTask`
- `queryMemory`
- `searchMemory`

## Recording progress

```ts
const result = await project.recordProgress({
  task_id: continuation.task.id,
  expected_revision: continuation.task.revision,
  source_environment: "local-agent",
  completed: ["Implemented the parser", "Added its regression test"],
  changed_files: ["src/parser.ts", "tests/parser.test.ts"],
  blockers: [],
  verification: [
    {
      check: "Parser tests",
      result: "passed",
      summary: "12 tests passed",
    },
  ],
  stopping_point: "The parser and focused tests are complete.",
  next_action: "Run the full package test suite.",
});
```

The response contains the advanced task, the new current handoff, quality
warnings, and records created by the operation. Reusing the older
`expected_revision` returns a typed `REVISION_CONFLICT`.

## Error model

SDK failures use `ZentextError` with a stable string `code`:

- `INVALID_INPUT`
- `UNSAFE_INPUT`
- `SECRET_DETECTED`
- `PROJECT_NOT_FOUND`
- `PROJECT_IDENTITY_MISMATCH`
- `RECORD_NOT_FOUND`
- `NO_ACTIVE_TASK`
- `NO_HANDOFF`
- `STALE_STATE`
- `REVISION_CONFLICT`
- `INVALID_STATE`
- `PAYLOAD_TOO_LARGE`
- `INTERNAL_ERROR`

Error details never include the detected secret value. The SDK redacts likely
secrets from returned canonical views, including legacy records.

## Schema compatibility

The initial public record schema version is `1`; the memory search schema is
`1`; and the stable memory interface version is `1.1`. Consumers should use
exported TypeScript types and capability
discovery rather than assume fields added by future versions.

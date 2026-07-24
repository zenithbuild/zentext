# Stable memory interface

Zentext is a **local-first project memory layer for AI tools**. The stable
memory interface is the provider-neutral domain boundary between canonical
SQLite records and consumers such as the CLI, TypeScript SDK, stdio RPC, MCP,
and project-local Codex skill.

Interface version: `1.1`
Record schema version: `1`

## Contract

```ts
interface MemoryStore {
  getActiveTask(): Promise<Task | null>;
  getCurrentHandoff(): Promise<CurrentHandoff | null>;
  getContinuation(): Promise<ContinuationView>;
  validateHandoff(handoffId?: string): Promise<HandoffValidationResult>;
  recordProgress(input: RecordProgressInput): Promise<ProgressResult>;
  updateTask(input: TaskUpdateInput): Promise<Task>;
  searchMemory(input: MemorySearchInput): Promise<MemorySearchPage>;
  queryMemory(input: MemoryQueryInput): Promise<MemoryRecord[]>;
  close(): void;
}
```

`SqliteMemoryStore` is the first implementation. The contract is
storage-independent, but it does not imply a cloud backend, synchronization,
graphs, or vectors.

## Canonical behavior

Every consumer receives the same continuation model and uses the same
transactional write domain. A caller cannot opt out of:

- formal input schemas and maximum sizes;
- project and record identity validation;
- task revision and stale-handoff checks;
- unsafe terminal, Unicode, path, and binary-like input rejection;
- likely-secret detection before persistence;
- redaction before structured output;
- provenance on newly created externally meaningful records;
- handoff-quality warnings.

SQLite records and revision history remain canonical. JSON, Markdown, prompts,
terminal output, SDK objects, RPC responses, and MCP results are views.
Projects without a Git origin use the canonical real filesystem path for
identity; moving them to a different path still produces a different ID.

`searchMemory` is the schema-versioned deterministic lexical retrieval
contract. `queryMemory` remains available for compatibility. See
[`memory-search.md`](./memory-search.md).

## Read and write operations

Read-only:

- `getActiveTask`
- `getCurrentHandoff`
- `getContinuation`
- `validateHandoff`
- `searchMemory`
- `queryMemory`

Mutating:

- `updateTask` requires `expected_revision`.
- `recordProgress` requires `expected_revision`, advances the task, stores
  provenance-bearing decision/blocker/verification records when supplied, and
  creates a new current handoff. The previous handoff is retained and validates
  as stale against the advanced task.

## Provenance

Applicable new records capture:

- source environment and capture time;
- project ID;
- task ID and revision;
- inspected files and commands executed;
- verification evidence;
- parent record and handoff IDs;
- whether an explicit secret-detector override was used.

Provenance is evidence, not a claim that an external command actually ran.
Consumers should record only checks they performed.

## Quality warnings

Handoffs remain valid structured records even when their content is weak.
Zentext returns actionable warnings for vague stopping points, missing
verification, missing next actions, missing completed work, conflicting task
status, and missing file references.

## Boundaries

The interface transfers explicit external project memory only. It never
transfers hidden model state, private reasoning, provider session history, or a
model's internal context window.

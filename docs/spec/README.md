# Zentext memory contract specifications

This directory contains versioned specifications for Zentext's local project
memory behavior.

The current specification is:

- [Zentext memory contract 1.1](./zentext-memory-contract/1.1/README.md)

Previous compatible contracts:

- [Zentext memory contract 1.0](./zentext-memory-contract/1.0/README.md)

The name describes a product contract, not an industry standard. Zentext will
not call this a universal protocol until independent compatible
implementations exist.

## Versioning policy

Specification directories are immutable once released except for objective
errata that do not change behavior. A behavioral incompatibility requires a
new versioned directory and an explicit compatibility/migration statement.

Implementation constants may version different layers independently:

- stored record schema;
- continuation view schema;
- MemoryStore interface;
- NDJSON RPC protocol and response schema; and
- environment formatter contract.

The implementation and executable tests remain the conformance oracle for this
repository. Specification prose does not override observed behavior.

## Repository placement

The specification stays in this repository while implementation and contract
evolve together. A separate repository should be considered only when an
independent implementation, separate governance, or release cadence creates a
concrete maintenance benefit.

# Module Structure (DDD Bounded Contexts)

Each directory under `/modules/` represents a bounded context from the enterprise architecture (Volumes 03-05).

## Convention

Each module will eventually contain:
- `types.ts` — Domain types and interfaces
- `queries.ts` — Read operations (repository pattern)
- `mutations.ts` — Write operations
- `events.ts` — Domain event definitions
- `rules.ts` — Business rules and invariants
- `index.ts` — Public API (exports only what other modules should import)

## Rules
- Modules communicate via domain events, not direct table reads across contexts.
- Cross-module imports should go through `index.ts`, never deep into internal files.
- No module directly accesses another module's database tables.

## Phase 1 Status
All modules are empty placeholders. Implementation begins in Phase 2+.

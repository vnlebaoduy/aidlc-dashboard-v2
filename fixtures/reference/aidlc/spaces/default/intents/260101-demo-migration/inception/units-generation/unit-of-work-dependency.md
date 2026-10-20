# Unit of Work Dependency

PU-A-core → PU-B-ui

## Assumptions & Open Questions

### Assumptions

- `[assumption]` PU-B-ui has no domain logic of its own. This is unconfirmed and has no assigned
  place to be checked.

### Open questions

| Item | Assignment |
| --- | --- |
| Where the two units' shared types live | `functional-design` |
| Directory convention for generated code | `code-generation` (`NEW-codegen-layout`) |
| How to secure a regression baseline | `build-and-test` (`C22`) |
| Deployment pipeline approver | next cycle |
| Source of truth for observability metrics | `NEW-metric-source` |

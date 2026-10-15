# VisionAttend documentation

Living documentation: it always describes the code as it is now. Each phase updates the docs it
affects (see `CLAUDE.md` §0.1), and `npm run docs:check` enforces the structure in CI.

| Document                                 | What it covers                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| [CHANGELOG.md](CHANGELOG.md)             | Dated list of changes, newest first                                    |
| [ARCHITECTURE.md](ARCHITECTURE.md)       | System overview and diagrams (data flow, face pipeline, auth flow)     |
| [DATABASE.md](DATABASE.md)               | Tables, relations, row-level security policies, ER diagram             |
| [API.md](API.md)                         | Server Actions, Route Handlers and RPCs: inputs, outputs, who may call |
| [DECISIONS.md](DECISIONS.md)             | Architecture Decision Records (what was chosen, alternatives, why)     |
| [SETUP.md](SETUP.md)                     | Local setup, environment variables, deployment                         |
| [TESTING.md](TESTING.md)                 | Test suites, how to run them, manual QA checklists                     |
| [USER_GUIDE.md](USER_GUIDE.md)           | How members use the app                                                |
| [ADMIN_GUIDE.md](ADMIN_GUIDE.md)         | How admins manage the organization                                     |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known issues and fixes                                                 |

## Phases

| Phase | Document                                                    | Status   |
| ----- | ----------------------------------------------------------- | -------- |
| 0     | [Project setup & foundation](phases/phase-00-foundation.md) | Complete |
| 1     | Authentication & account management                         | Next     |
| 2–12  | See `CLAUDE.md` §4                                          | Planned  |

Progress and the current manual test list live in [`PROGRESS.md`](../PROGRESS.md) at the repository
root.

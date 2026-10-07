*Authored by Claude Sonnet 5.5 (Anthropic), with Steven Chock as co-author.*

# 0004: Integration modes and secrets

Status: **proposed.** The philosophy in the first paragraph is Steven's. The mechanisms below are Claude's proposals, built in `src/prototypes/ui` so they can be judged by running them. The industry notes come from Claude's own knowledge, not a search, and are **unverified**.

## Philosophy

Prototypes **rise** from mockups to real integrations. Prod **falls** from real integrations to mockups. So a prototype starts on mocks and gains real parts one at a time, and the mocks stay as the tests' default and the fallback. Prod starts real, and a mock is what remains when the real thing is unavailable or unwanted.

## Decisions

| Question | Proposal |
|---|---|
| What is the default? | **Mock**, for `npm run dev` and `npm test`. Nothing real runs unless asked for |
| How is real asked for? | A mode, `mock` or `real`: `VITE_INTEGRATION` in an env file, or `?integration=real` in the address bar. `npm run dev:real` loads `.env.real` |
| Where does the choice live in code? | One composition root, `src/composition/`. It is the only place that knows which adapter backs which port. Core and UI see ports only |
| Granularity | Per port, not one global switch, so a real part can sit beside a mock part. Today: real **setup**, mock **hardware** (the API has no verify endpoint yet). The page says so, always |
| A bad mode value | An error on screen. Never a silent fall back to mock |
| How do tests switch? | Default `npm test` and `npm run test:e2e` use mocks. `npm run test:integration` and `npm run test:e2e:real` use the real API. They are separate commands and separate files (`*.integration.spec.ts`, `*.real.spec.ts`), never mixed into the default run |
| How is a mock kept honest? | **One contract suite per port, run against both the mock and the real adapter** (`src/adapters/setupHostContract.ts`). If the mock passes and the real one fails, the mock is lying. This already paid off: the suite showed the mock forgot what was uploaded, and running the real API showed the page keyed a message off the mock's id format |
| What if the real API is down? | Integration tests **skip loudly** (a warning and a skipped count). `INTEGRATION_REQUIRED=1` turns the skip into a failure, for CI |
| Browser or server for secrets? | **Server.** The browser holds no secrets, ever |

## Secrets

**The rule: a mode is configuration, a credential is a secret, and they live in different places.** The mode and the API address are public and go in committed env files. Credentials never enter the browser, the repo, or a file the UI reads.

### Why `.env` files are not enough

- **`VITE_` variables are public.** Vite bundles them into the page. A key there is published.
- **A plaintext key in the workspace is readable by anything that reads the workspace**, including a coding agent such as Claude Code, whose reads can end up in transcripts. A committed leak is one risk; this is another.
- Scanners catch a committed key after the fact. They do not stop a key sitting on disk.

### What the industry is doing (unverified, from Claude's knowledge)

- Secrets injected at runtime from a manager (1Password `op run`, Doppler, Infisical, Vault, cloud secret managers), with nothing on disk.
- Encrypted env files (for example dotenvx), with the key kept apart.
- Short-lived credentials in CI through OIDC federation, in place of long-lived repo secrets.
- Secret scanning and push protection, on by default on GitHub.
- `.env` kept for **non-secret** config, with a committed `.env.example`.

### What this project does

1. **Today there are no secrets.** The models are local and the API prototype needs none. The mode switch is built; a secret manager is not, on purpose.
2. **Committed env files hold public values only.** The prototype's `.gitignore` ignores every `.env*` except `.env.example` and `.env.real`. A test (`src/composition/envFiles.spec.ts`) fails if another `.env*` file appears, or if a committed one sets a name that is not `VITE_`-prefixed or that sounds secret (`KEY`, `SECRET`, `TOKEN`, `PASSWORD`, and so on). It is best effort: it cannot catch a secret with an innocent name.
3. **When the first secret exists** (a cloud provider for the `{cloud}` model slots): it belongs to the **server** process. It reaches that process from a secret manager or the OS keychain, injected for the command (`op run -- dotnet run …`), not stored in a project file. For a user's own key, entered in Advanced settings, the server stores it in the OS keychain. The browser sends it once and never reads it back.
4. **Real-integration tests get secrets the same way**, injected for the command. A test that needs a secret it does not have **skips loudly**, like the unreachable API.
5. **Claude does not read or print secret files or stores**, and never writes a secret into a file. (`CLAUDE.md`.)

## Mocks in production

Decided by Steven (2026-10-07): **prod does ship the mocks, behind a feature flag.** The five points below were proposed by Claude and each accepted by Steven, with the clarification noted in point 1. Status of the mechanism is still **proposed**: nothing here is built.

Industry background (Claude's knowledge, unverified): testing in production is accepted as an addition to pre-prod testing, when it comes with progressive rollout, a fast off switch, observability and isolated test data. Its known failure modes are flag debt, untested flag combinations, polluted data, a larger attack surface and treating a flag as a security boundary. Sources named from memory include Charity Majors, Cindy Sridharan, Martin Fowler and Pete Hodgson on feature toggles, Google SRE on canarying, and the OpenFeature standard.

1. **The flag is an ops and permission flag, and it works like a claim.** It is not a release flag, which should be short-lived and deleted. It is long-lived configuration, off by default, with a named owner. It has two parts:
   - **Permission (who):** it is evaluated **per user or group**, like a claim or role, so only specific groups are routed to the mock. In OpenFeature terms the user's attributes are the *evaluation context* and "may use mocks" is the targeted value. Example groups: demo, tester, support.
   - **Ops (everything at once):** a system-wide switch that turns mock mode off for everyone, or on for a whole deployment such as a demo build.
   - **Who can set it:** the server evaluates it, from claims the server issues or verifies, never from a value the client supplies. A flag is not an access control, but the label in point 4 must not be removable by the person looking at it.
   - **Self-hosted, single user:** there is no identity service, so a local server setting stands in for the claim. The question the code asks is one function, `mockAllowed(context)`, whatever its source.
   - **Not designed yet:** users, groups and identity. This ADR assumes claims exist; `specs/session-management.md` is where they would be settled.
2. **The flag is a local setting or a server-evaluated claim, not a flag-management service.** This is a local-first product, so "prod" is often the user's own machine. A hosted flag service does not fit. Use OpenFeature's API with a local provider, so a service can be swapped in later without changing callers.
3. **Mocks are loaded only when the flag allows them.** A lazy import behind the flag keeps the mock code out of the main bundle, which keeps the shipped surface small.
4. **A mock run is always labeled, and the label is mandatory.** The integration bar already does this in the prototype, and it becomes a requirement in prod. It applies most to anything a user could take as real: scripted feedback or a scripted evaluation shown as a real one would be a real harm. It must reach screen reader users in words, as the cues do. A mock can never remove or hide its own label.
5. **Mock and test mode use ephemeral persistence.** The dependency injection for mock and test mode must supply in-memory or ephemeral stores, so a mock can never write to a real store. This follows from the test-data pollution failure above. The API prototype already has in-memory stores (`InMemoryStores.cs`), and the UI's mock host keeps what it is given only in memory. What is still missing is the rule, enforced: **mock mode must be unable to construct a real store**, not merely expected not to.

Steven also wants testing treated as a **first-class part of the system's design**, including this persistence layer. That design is a task, not part of this ADR (see `TASKS.MD`).

## Consequences

- A developer can run the whole UI with no server and no setup, and the tests prove behavior without a network.
- Switching to real is one flag, and the page states what is real. Mixed modes are possible and visible.
- Every new port needs a contract suite. That is real work, and it is the cost of trusting the mock.
- The dev server proxies `/api` to the API (`API_PROXY_TARGET`, default `http://localhost:5036`), so the browser needs no CORS setup. **That proxy is a development convenience.** How the UI reaches the API in a real deployment is not decided here.

## Open

- **The mocks-in-prod mechanism, remaining questions:** which claims and groups exist (needs identity, see point 1), what a flag change is audited as, and whether the mock label is tested by a spec or only reviewed. The flag itself, its kind, its source, the lazy loading, the label and ephemeral persistence are decided above.
- **Which secret manager**, decided with the first cloud integration. 1Password, Doppler and the OS keychain all fit; the choice depends on whether other people will run the project.
- **Per-port modes from the command line.** Today the real mode flips setup and leaves hardware mock by construction. A finer switch (`VITE_INTEGRATION=setup:real,hardware:mock`) is possible and not built, because there are only two parts.
- **The API's hardware endpoint and `InterviewPrepared` delivery** are not designed. Until they are, real mode reports preparation `ready` on the API's `202`, which is a guess (flagged in `httpSetupHost.ts`).
- **The slot-choice wire shapes** (`{ "type": "custom-local" }`, `{ "type": "cloud" }`) are the API prototype's proposal, and the UI now sends them. Named options use the contract's strings (`default`, `interviewer`), where the UI used to send its labels.

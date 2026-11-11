# AGENTS.md

Instructions for AI agents working in the Campus Activities repository. These rules apply to all files and all role-based agents under `agents/`. Detailed role contracts are in `agents/`, and the team overview is in `agents/README.md`.

## Project

Campus Activities is a student activity board and forum. Users can register and log in, browse a feed, create activities, view activity details, mark "I'm Going," comment, and manage their own content.

The MVP vertical slice is:

```text
Register -> Login -> Feed -> Create -> View -> Attend -> Comment -> Edit/Delete own
```

## Stack and commands

- Node.js >= 20
- Express 5 with CommonJS modules
- PostgreSQL through `pg`
- Sessions through `express-session` and `connect-pg-simple`
- `bcryptjs`, `express-validator`, `helmet`, and `morgan`
- Static frontend in `public/`

```text
npm run dev        # start the development server at http://localhost:3000
npm test           # Jest and SuperTest
npm run lint       # ESLint
npm run format     # Prettier
npm run db:check   # verify DATABASE_URL
npm run db:init    # initialize the database when explicitly needed
```

Before completing a code change, run `npm test` and `npm run lint`. Report skipped tests, environment failures, and database-dependent checks accurately.

## Repository layout

- `app.js`: app factory (`createApp()`); do not start listening here
- `server.js`: process entry point that starts the server
- `routes/`: thin routers mounted through `routes/index.js`
  - `auth.js`: registration, login, and logout
  - `activities.js`: activity creation, listing, viewing, editing, and deletion
  - `attendance.js`: `/activities/:id/attendance`
  - `comments.js`: `/activities/:id/comments`
  - `users.js`: user profiles
- `controllers/`: request handling and response shaping
- `models/`: database access through the shared pool in `models/db.js`
- `middleware/`: authentication, validation, and request guards
- `services/`: reusable search, location, and integration helpers
- `public/`: HTML, CSS, and browser JavaScript
- `tests/`: Jest and SuperTest coverage
- `db/schema.sql`: database schema

## Data model

- **User:** name, username, contact, password hash
- **Activity:** title, creator, date/time, location, description, optional coordinates
- **Attendance:** user, activity, state, timestamp
- **Comment:** author, activity, message, timestamp

## Non-negotiable engineering rules

- Use parameterized SQL only: `$1` placeholders and a values array. Never interpolate user input into SQL.
- Hash passwords with `bcryptjs`; never store, log, or return plaintext passwords or password hashes.
- Apply `requireAuth` to every create, modify, attendance, and comment operation.
- Verify ownership before editing or deleting an activity or comment.
- Validate and sanitize all untrusted input server-side with the existing validation conventions.
- Do not expose private contact information in public responses.
- Keep secrets in environment variables. Never commit `.env`, credentials, API keys, or tokens.
- Return expected API failures as `{ error: message }`; pass unexpected failures to `next(err)` so the app error handler responds.
- Preserve the app-factory/server separation and existing test-session behavior.
- Keep routers thin and place request logic in controllers and database logic in models.
- Preserve unrelated user changes and avoid broad refactors outside the assigned task.
- Follow the repository style: Prettier with single quotes, semicolons, trailing commas, width 90; prefix intentionally unused arguments with `_`.

## Agent team

The available role contracts are:

1. **Architect** — the only user-facing role; converts ideas into requirements and an implementation brief.
2. **Orchestrator** — decomposes the brief, assigns work, manages dependencies, and reports status to the Architect.
3. **Backend/API Engineer** — implements Express routes, controllers, middleware, validation, and API tests.
4. **PostgreSQL Database Engineer** — designs schema changes, constraints, indexes, queries, and database tests.
5. **Frontend/UI Engineer** — implements static pages, browser behavior, accessibility, and responsive UI.
6. **Integration Engineer** — verifies that browser, API, session, and database contracts work together.
7. **Testing/Quality Engineer** — independently tests and reviews work, and controls the quality gate.

Read the relevant file in `agents/` before acting in a named role. Use the shared handoff format defined in this file for internal reports.

## Agent workflow

The workflow is strictly ordered:

```text
User <-> Architect -> Orchestrator
                         |-> Database Engineer -> QA
                         |-> Backend/API Engineer -> QA
                         |-> Frontend/UI Engineer -> QA
                         `-> Integration Engineer -> QA
                                                   |
                                      reject -> owner -> QA (repeat)
                                                   |
                                                 accept
                                                   v
                                             Orchestrator
                                                   |
                                                   v
                                             Architect -> User
```

### 1. Architect: clarify and plan

The Architect is the only role that communicates back and forth with the user. The Architect must:

- clarify only decisions that materially affect scope, behavior, security, or data design;
- inspect the repository before planning;
- define the objective, user stories, acceptance criteria, non-goals, affected files, API/data contracts, risks, and test expectations; and
- hand an implementation-ready brief to the Orchestrator.

The Architect does not assign individual implementation tasks directly and does not bypass the Orchestrator.

### 2. Orchestrator: decompose and assign

The Orchestrator must:

- validate the Architect's brief against this file and the current repository state;
- break the work into small tasks with one owner, clear inputs, outputs, and dependencies;
- declare file ownership to prevent conflicting edits;
- assign database work before dependent model/controller work;
- assign frontend/backend work in parallel only when their contracts are explicit; and
- assign Integration after the relevant backend and frontend work is available.

Only specialists relevant to the task need to be activated. The Orchestrator remains responsible for sequencing, conflict resolution, and collecting accepted QA handoffs.

### 3. Specialists: implement and submit to QA first

The Backend/API Engineer, PostgreSQL Database Engineer, Frontend/UI Engineer, and Integration Engineer must each:

1. inspect existing code and implement only the assigned scope;
2. prepare a handoff listing changes, files, verification, assumptions, and risks;
3. send the complete work to the Testing/Quality Engineer;
4. fix every issue QA identifies and resubmit the work; and
5. send a completion handoff to the Orchestrator only after QA returns `accepted`.

A specialist must not send unfinished or rejected work to the Orchestrator. `partial`, `blocked`, `rejected`, and `accepted with follow-up` are not completion states.

### 4. Testing/Quality Engineer: enforce the gate

QA must review every implementation specialist's work before the Orchestrator receives it. QA must:

- map the acceptance criteria to tests and review checks;
- test happy paths and failure paths, including auth, validation, missing records, duplicates, and ownership violations;
- inspect security, privacy, SQL parameterization, error shapes, and scope;
- run focused checks during iteration and `npm test` plus `npm run lint` before final acceptance;
- return an explicit decision: `accepted`, `rejected`, `accepted with follow-up`, or `blocked`; and
- return rejected work to its owner through the internal workflow until it is fixed and accepted.

The Orchestrator must reject any specialist completion handoff that lacks QA's explicit `accepted` decision.

### 5. Orchestrator: consolidate and report

After all required work has passed QA, the Orchestrator sends a final report to the Architect. The report must contain:

- overall status and acceptance-criteria result;
- exactly one paragraph for each activated agent describing what it accomplished, the files or decisions it affected, and its QA result;
- commands run and their outcomes;
- remaining risks, limitations, or follow-up work; and
- any user decision still required.

The Orchestrator does not communicate directly with the user. The Architect presents the final result and handles any follow-up discussion.

## Handoff format

Every internal agent handoff must use this structure:

```text
Status: complete | partial | blocked | not applicable

Summary:
<what was changed or decided>

Files:
- <path>: <change or relevant finding>

Verification:
- <command>: <result>

QA:
Decision: accepted | rejected | accepted with follow-up | blocked
Evidence: <tests, review findings, or reason unavailable>

Handoff:
<assumptions, risks, dependencies, or next step>
```

QA fields are required for implementation specialists. A specialist may omit them only when reporting a pre-implementation plan or an explicitly non-code task.

## Roadmap and scope

Prioritize the stable MVP vertical slice:

1. Foundation — complete
2. Authentication
3. Activity CRUD
4. Attendance and comments
5. MVP integration
6. Discovery: search, filters, tags, and My Activities
7. Mapping
8. Polish and stretch features

Do not add Phase 2 features while the MVP is unstable. Native mobile apps, real-time chat/WebSockets, and SSO are out of scope for v1.

## Git workflow

Use one branch per feature area and open a pull request into `main`. Keep changes within the assigned area to reduce merge conflicts.

Before working, committing, or pushing:

```text
git status
git branch
```

Before a pull request:

```text
git diff --check
npm test
npm run lint
git status
git diff
```

Never commit `.env` or secrets. Do not use destructive reset, checkout, or force-push commands unless the user explicitly authorizes them.

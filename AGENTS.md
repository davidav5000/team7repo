# AGENTS.md

Guide for AI coding agents working in this repo. Full spec: `Activities_Web_App_Project_Plan.docx`.

## Project

Campus Activities: student activity board + forum. Users register/login, browse a feed, create activities (title, host, date/time, location, description, optional coords), mark "I'm Going", and comment.

Stack: Node >=20, Express 5 (CommonJS), PostgreSQL via `pg`, `express-session` + `connect-pg-simple`, `bcryptjs`, `express-validator`, `helmet`. Frontend: static `public/` (tech TBD).

## Commands

```
npm run dev        # nodemon, http://localhost:3000
npm test           # jest + supertest
npm run lint       # eslint (lint:fix to autofix)
npm run format     # prettier
npm run db:check   # verify DATABASE_URL
```

Run `npm test` and `npm run lint` before finishing a change.

## Layout

- `app.js`: app factory (`createApp()`); `server.js`: listen only
- `routes/`: thin routers, mounted in `routes/index.js`
  - `auth.js`: `/register`, `/login`, `/logout`
  - `activities.js`: `/activities`, `/activities/:id`
  - `attendance.js`: `/activities/:id/attendance`
  - `comments.js`: `/activities/:id/comments`
  - `users.js`: `/users/:id` / profile
- `controllers/`: request handling; `models/`: DB access (`models/db.js` shared pool)
- `middleware/requireAuth.js`: 401 unless `req.session.userId`
- `services/`: search/location helpers; `tests/`: jest + supertest

## Data model

User (name, username, contact, password hash) · Activity (title, creator, datetime, location, description, coords) · Attendance (user, activity, state/timestamp) · Comment (author, activity, message, timestamp).

## Rules

- **SQL**: always parameterized, `db.query(sql, [params])` with `$1` placeholders. No string interpolation.
- **Passwords**: hash with bcryptjs; never store or log plaintext.
- **Auth**: `requireAuth` on any create/modify/attend/comment route.
- **Ownership**: verify `req.session.userId` owns the activity/comment before edit/delete.
- **Validation**: validate and sanitize all input server-side (express-validator).
- **Privacy**: don't expose user contact info or password hashes in responses.
- **Secrets**: env vars only (`.env`, see `.env.example`); never commit `.env`.
- **Errors**: JSON `{ error: message }`; pass to `next(err)` and let the app error handler respond.
- **Style**: Prettier (single quotes, semicolons, trailing commas, width 90); prefix unused args with `_`.
- **Tests**: `NODE_ENV=test` uses the memory session store; add supertest coverage for new routes.

## Roadmap / priority

Build a vertical slice first: Register → Login → Feed → Create → View → Attend → Comment → Edit/Delete own.

1. Foundation (done) · 2. Auth · 3. Activity CRUD · 4. Attendance + comments · 5. MVP integration
6. Discovery (search, filters, tags, My Activities) · 7. Mapping · 8. Polish/stretch

Out of scope for v1: native mobile apps, real-time chat/WebSockets, SSO. Don't add Phase 2+ features until the MVP is stable.

## Workflow

One branch per feature area (auth, activities, interaction, discovery); PR into `main`. Keep changes within your area's routes/modules to avoid merge conflicts.

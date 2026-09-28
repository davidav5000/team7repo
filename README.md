# Campus Activities (team7repo)

Student activity forum. Node.js + Express. See `Activities_Web_App_Project_Plan.docx`.

## Setup

```
npm install
cp .env.example .env   # set SESSION_SECRET + DATABASE_URL (your pg password/port)
psql -U postgres -p <port> -c "CREATE DATABASE activities;"
npm run db:check       # verify DB connection
npm run dev            # http://localhost:3000
```

## Scripts

| cmd                         | purpose          |
| --------------------------- | ---------------- |
| `npm run dev`               | nodemon          |
| `npm start`                 | prod start       |
| `npm test`                  | jest + supertest |
| `npm run lint` / `lint:fix` | eslint           |
| `npm run format`            | prettier         |
| `npm run db:check`          | test DB conn     |

## Layout

`app.js` (app factory) · `server.js` (listen) · `routes/` · `controllers/` · `models/` · `middleware/` · `services/` · `public/` · `views/` · `tests/`

## Database

PostgreSQL via `pg`. Shared pool in `models/db.js`: `db.query(sql, params)` – always use `$1` placeholders. Sessions stored in Postgres (`session` table auto-created); tests use memory store.

## Open decisions

- Frontend tech (static `public/` for now)

## Workflow

Branch per feature area (auth, activities, interaction, discovery); PR into `main`.

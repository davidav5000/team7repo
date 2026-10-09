# Campus Activities (team7repo)

Student activity forum. Node.js + Express. See `Activities_Web_App_Project_Plan.docx`.

## Setup

```
yo
npm install
cp .env.example .env   # set SESSION_SECRET + DATABASE_URL (your pg password/port)
psql -U postgres -p <port> -c "CREATE DATABASE activities;"
npm run db:check       # verify DB connection
npm run dev            # http://localhost:3000
```

## Google Maps Static API

Enable the Maps Static API in Google Cloud, create an API key restricted to that
API, and set `GOOGLE_MAPS_API_KEY` in `.env`. The server exposes a small image
proxy at:

```
GET /api/maps/static?lat=40.015&lng=-105.2705&zoom=15
```

Use the endpoint as an image source, for example:

```html
<img src="/api/maps/static?lat=40.015&lng=-105.2705" alt="Activity location map" />
```

The route validates coordinates and Static Maps dimensions, then fetches the
image server-side so the API key does not appear in browser HTML or JavaScript.

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

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

## Comments and profile pictures

Run `npm run db:init` after configuring `DATABASE_URL`, before starting this version.
It creates new tables or upgrades existing ones with nullable `users.avatar_url`.
It is safe to run repeatedly; existing users initially have no profile picture.

| Endpoint                        | Authentication | Request / response                                                                                               |
| ------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /activities/:id/comments`  | Public         | `{ comments: [...] }`, oldest first                                                                              |
| `POST /activities/:id/comments` | Login required | Send `{ "message": "See you there!" }`; returns `201` with `{ comment: ... }`                                    |
| `PUT /users/me/avatar`          | Login required | Send `{ "avatarUrl": "https://example.com/photo.jpg" }` or `{ "avatarUrl": null }`; returns `{ avatarUrl: ... }` |
| `GET /users/me`                 | Login required | Existing `{ user: ... }` response now includes `user.avatarUrl`                                                  |

Each comment includes `id`, `activityId`, `authorId`, `authorUsername`,
`authorAvatarUrl`, `message`, and `createdAt`. Author details come from the account,
never from the posted request. Contact information and password hashes are not
included in comments. Messages are trimmed and must contain 1–2,000 characters.
An invalid request returns JSON with `error` and validation `details`; a missing
activity returns `404`.

Avatar URLs must use HTTPS, include a hostname, contain no embedded credentials,
and be at most 2,048 characters after trimming. Send `null` to remove a picture;
an empty string is invalid. The server stores the link without fetching or
verifying the image. Clients should show an initial/default avatar when the URL
is `null` or fails to load. Existing comments use the account's current picture.
Future photo uploads can store a hosted URL in the same field without changing
comment responses. This API change does not add uploads or frontend rendering.

For optional live PostgreSQL tests, set `AVATAR_TEST_DATABASE_URL` to a test
database connection string and run `npm test -- --runInBand avatarIntegration`.
These tests use temporary tables and roll back their changes; they verify fresh
initialization, upgrades, and the authenticated avatar/comment flow.

## Open decisions

- Frontend tech (static `public/` for now)

## Workflow

Branch per feature area (auth, activities, interaction, discovery); PR into `main`.
See [WORKFLOW.md](WORKFLOW.md) for the complete workflow and conflict recovery guide.

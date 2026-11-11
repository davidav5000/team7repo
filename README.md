# Campus Activities (team7repo)

Student activity forum. Node.js + Express. See `Activities_Web_App_Project_Plan.docx`.

## Setup

```
npm install
cp .env.example .env   # set SESSION_SECRET + DATABASE_URL (your pg password/port)
psql -U postgres -p <port> -c "CREATE DATABASE activities;"
npm run db:check       # verify DB connection
npm run db:init        # create/update database tables
npm run dev            # http://localhost:3000
```

## Google Maps Static API

Enable the Maps Static API and Places API (New) in Google Cloud, create an API
key restricted to those APIs, and set `GOOGLE_MAPS_API_KEY` in `.env`. The key
is used only by the server and must not be placed in browser HTML or JavaScript.
The server exposes a small image proxy at:

```
GET /api/maps/static?lat=40.015&lng=-105.2705&zoom=15
```

Use the endpoint as an image source, for example:

```html
<img src="/api/maps/static?lat=40.015&lng=-105.2705" alt="Activity location map" />
```

The route validates coordinates and Static Maps dimensions, then fetches the
image server-side so the API key does not appear in browser HTML or JavaScript.

The location picker can search for places around Rexburg through:

```
GET /api/maps/search?q=library
```

The response is normalized to `{ places: [{ name, address, latitude, longitude }] }`.
Search input is trimmed and limited to 100 characters. The server applies a
Rexburg-centered bias, limits results, and returns application-level errors for
invalid input or Google provider failures.

## Scripts

| cmd                         | purpose          |
| --------------------------- | ---------------- |
| `npm run dev`               | nodemon          |
| `npm start`                 | prod start       |
| `npm test`                  | jest + supertest |
| `npm run lint` / `lint:fix` | eslint           |
| `npm run format`            | prettier         |
| `npm run db:check`          | test DB conn     |
| `npm run db:init`           | apply DB schema  |

## Layout

`app.js` (app factory) · `server.js` (listen) · `routes/` · `controllers/` · `models/` · `middleware/` · `services/` · `public/` · `views/` · `tests/`

## Database

PostgreSQL via `pg`. Shared pool in `models/db.js`: `db.query(sql, params)` – always use `$1` placeholders. Sessions stored in Postgres (`session` table auto-created); tests use memory store.

## Comments and profile pictures

Run `npm run db:init` after configuring `DATABASE_URL`, before starting this version.
It creates or upgrades `users.avatar_url` and creates `user_avatars` for uploaded
picture bytes (`BYTEA`) and revision UUIDs. Each user has at most one stored
picture; deleting the user cascades to that picture. Setup is safe to repeat and
preserves existing users and URL-based pictures. Run it before using uploads on
an existing database; the application does not apply schema changes at startup.

| Endpoint                             | Authentication | Request / response                                                                                             |
| ------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /activities/:id/comments`       | Public         | `{ comments: [...] }`, oldest first                                                                            |
| `POST /activities/:id/comments`      | Login required | Send `{ "message": "See you there!" }`; returns `201` with `{ comment: ... }`                                  |
| `PUT /users/me/avatar`               | Login required | Send `multipart/form-data` with one file field named `avatar` and no text fields; returns `{ avatarUrl: ... }` |
| `DELETE /users/me/avatar`            | Login required | Removes the stored picture or legacy URL; returns `{ avatarUrl: null }`                                        |
| `GET /users/:id/avatar?v=<revision>` | Public         | Returns WebP bytes for the matching revision, or JSON `404` for missing/stale pictures                         |
| `GET /users/me`                      | Login required | Existing `{ user: ... }` response now includes `user.avatarUrl`                                                |

Each comment includes `id`, `activityId`, `authorId`, `authorUsername`,
`authorAvatarUrl`, `message`, and `createdAt`. Author details come from the account,
never from the posted request. Contact information and password hashes are not
included in comments. Messages are trimmed and must contain 1–2,000 characters.
An invalid request returns JSON with `error` and validation `details`; a missing
activity returns `404`.

The profile page offers a file picker, local preview, Save picture, and Remove
picture. Selecting a file does not upload it. The current saved picture remains
until saving succeeds; upload failures preserve it. Controls are disabled during
requests, status messages announce results, and missing/unavailable pictures fall
back to an initial. Preview URLs are released when cleared or leaving the page.

Uploads accept JPEG, PNG, or WebP files up to 5 MiB (5,242,880 bytes; shown as
"5 MB" in the UI) and at most 25 million pixels. Actual file content must match
the declared type. Corrupt, unsupported, and animated pictures are rejected.
Sharp applies orientation, center-crops to 256 x 256, and encodes WebP at quality
80 without original metadata. File-size failures return JSON `413`; invalid
uploads return JSON `400`. Authentication is checked before parsing uploads, and
the session user determines whose picture changes. JSON URL updates are retired;
existing external picture URLs remain visible until replaced or removed.

The data flow is browser `FormData` -> authenticated route -> Multer upload
middleware -> Sharp image service -> controller -> avatar model -> PostgreSQL.
The model uses one connection and a transaction to update picture bytes and the
user's URL together, locking the user row to serialize concurrent changes. Each
replacement gets a fresh revision URL. Profile/comment queries read the URL,
not binary bytes; comments use the author's current URL when loaded. The browser
fetches the image URL separately. Pictures are public, including those displayed
on comments. Image responses use an ETag and `Cache-Control: public, no-cache`
so clients revalidate; a still-current matching ETag can return `304`.

For example, a browser upload uses:

```js
const form = new FormData();
form.append('avatar', fileInput.files[0]);
await fetch('/users/me/avatar', {
  method: 'PUT',
  credentials: 'same-origin',
  body: form,
});
```

Let the browser set `Content-Type` and its multipart boundary. Do not send the
file as JSON or set `Content-Type: application/json`.

For optional live PostgreSQL tests, set `AVATAR_TEST_DATABASE_URL` to a test
database connection string and run `npm test -- --runInBand avatarIntegration`.
Use `NODE_ENV=test` when loading environment configuration into a custom test
launcher; normal `npm test` sets it automatically when not already defined.
These tests use session-local tables in `pg_temp`, discarded after each test;
they do not migrate or change persistent application tables. They verify fresh
initialization, repeated upgrades, binary persistence, transaction rollback,
and the authenticated upload -> comments -> replacement -> removal flow. The
test database must allow temporary tables. Without this variable, these tests
are skipped. Normal `npm test` also covers processing, HTTP contracts, and
frontend behavior using mocked browser/DB boundaries; those checks do not replace
a live browser and PostgreSQL smoke test.

## Open decisions

- Frontend tech (static `public/` for now)

## Workflow

Branch per feature area (auth, activities, interaction, discovery); PR into `main`.
See [WORKFLOW.md](WORKFLOW.md) for the complete workflow and conflict recovery guide.

## Production configuration

When `NODE_ENV=production`, both `SESSION_SECRET` and `DATABASE_URL` are required.
Startup fails immediately if either is missing. Use a long random session secret
and keep all real credentials in environment configuration, not in Git.

The app trusts one reverse-proxy hop in production so secure session cookies work
when HTTPS terminates at a reverse proxy.


### Private local database setup (macOS)

With PostgreSQL installed, run `npm run setup:local`, then `npm start`.
The setup creates a private project database on `127.0.0.1:55432`, applies
`db/schema.sql`, and writes generated credentials to the ignored `.env` file.
It leaves an existing non-placeholder database configuration alone and refuses
to replace it. Database files stay in ignored `.local-postgres/`.
If PostgreSQL tools are elsewhere, set `POSTGRES_BIN` to their bin directory.
Run setup again after restarting your Mac to start the database again.
Stop it with `npm run db:local:stop`; saved accounts and activities are retained.

Open `http://localhost:3000/register.html` (use the app server, not Live Server).
Register an account, then open Create and post an activity. Log out and sign in
with the same account to verify login and saved activities. Posting requires a
session; the backend identifies the activity creator from that session.
Never commit `.env` or share its generated credentials.

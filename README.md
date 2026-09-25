# Campus Activities (team7repo)

Student activity forum. Node.js + Express. See `Activities_Web_App_Project_Plan.docx`.

## Setup

```
npm install
cp .env.example .env   # set SESSION_SECRET
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

## Layout

`app.js` (app factory) · `server.js` (listen) · `routes/` · `controllers/` · `models/` · `middleware/` · `services/` · `public/` · `views/` · `tests/`

## Open decisions

- Database (not chosen yet) – add in `models/`, `DATABASE_URL` in `.env`
- Frontend tech (static `public/` for now)

## Workflow

Branch per feature area (auth, activities, interaction, discovery); PR into `main`.

# Goal System

A small Arabic (RTL) goal tracker built with plain JavaScript, Express and SQLite.
The browser app uses the REST API for all data, and the database is stored locally.

## Features

- Goals with status, priority and tags
- Plans and work sessions
- Tasks inside sessions
- Resources and notes
- Dashboard, archive and settings pages
- Dark/light mode
- JSON export and import
- Delete-all option

## Stack

- HTML/CSS/JavaScript
- Tailwind CSS via CDN
- Node.js + Express
- SQLite with `better-sqlite3`
- Jest + Supertest

## Project structure

```text
public/
  index.html
  css/style.css
  js/app.js
  js/api.js
server/
  server.js
  app.js
  db/
  routes/
  middleware/
tests/
  api.test.js
```

`app.js` builds the pages and handles the hash-based navigation. The server has a
separate router for each main resource. SQLite relations are defined in
`server/db/schema.sql`.

## Run

Node.js 20 or newer is required.

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

For development:

```bash
npm run dev
```

The default database is `data/goal-system.db`. `PORT`, `HOST` and `DB_PATH` can
be set with environment variables. The default host is `127.0.0.1`.

The page loads Tailwind and the Tajawal font from their CDNs, so internet access
is needed for the styling in the browser.

## API

All API routes start with `/api`.

| Method | Path |
|---|---|
| GET/POST | `/api/goals` | list/create goals |
| GET/PATCH/DELETE | `/api/goals/:id` | view/update/delete a goal |
| POST | `/api/plans` | create a plan |
| PATCH/DELETE | `/api/plans/:id` | update/delete a plan |
| GET/POST | `/api/sessions` | list/create sessions |
| GET/PATCH/DELETE | `/api/sessions/:id` | view/update/delete a session |
| POST | `/api/tasks` | create a task |
| PATCH/DELETE | `/api/tasks/:id` | update/delete a task |
| POST | `/api/resources` | create a resource |
| PATCH/DELETE | `/api/resources/:id` | update/delete a resource |
| GET/POST | `/api/notes` | list/create notes |
| PATCH/DELETE | `/api/notes/:id` | update/delete a note |
| GET | `/api/export` | export all data |
| POST | `/api/import` | replace data from a backup |
| DELETE | `/api/data` | clear all data |

The server validates request data before writing to SQLite. IDs are checked,
URLs are limited to `http`/`https`, and SQL values are passed as parameters.

## Tests

```bash
npm test
```

The tests use an in-memory SQLite database, so they do not modify the normal
`data/goal-system.db` file. They cover CRUD operations, validation, relationships,
sessions/tasks and export/import.

## Notes

This is a single-user app and has no authentication. The frontend is intentionally
plain JavaScript rather than a framework. Some edit operations exist in the API
but are not exposed in the current interface.

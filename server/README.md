# Openwork server

A small Rust server (Axum + Tokio + SQLite) for the Openwork open-source base. It stores rooms, messages and file records pushed by the browser, hands them back on pull, keeps file bytes on disk, and serves the built frontend. Single user, no accounts: it binds to 127.0.0.1 by default.

## Build

    cd server
    cargo build --release

The binary is `target/release/openwork-server`. Rust 1.88 or newer.

## Run

    cargo run -p ow-server -- --static ../app/dist

| Flag | Env | Default |
|---|---|---|
| `--host` | `OPENWORK_HOST` | `127.0.0.1` |
| `--port` | `OPENWORK_PORT` | `47410` |
| `--data <dir>` | `OPENWORK_DATA` | `./data` (created if missing) |
| `--static <dir>` | `OPENWORK_STATIC` | `../app/dist` |

If the static folder has no `index.html`, every non-API GET answers 503 with a plain message. Exposing the server beyond localhost is your choice; it has no auth.

Data: `<data>/openwork.db` (SQLite, migrations in `crates/ow-store/migrations`) and `<data>/files/<fileId>` (bytes; the content type is kept in the database).

## API

- `GET /healthz` returns `ok`.
- `POST /api/push` with `{ "changes": Change[] }` returns `{ "answers": Answer[] }`. Last writer wins by `updatedAt`; an older change is answered `ok: true` and ignored.
- `GET /api/pull?since=<cursor>` returns `{ "changes": Change[], "cursor": number }`. `since=0` returns everything.
- `PUT /api/files/:id` (raw bytes, `Content-Type`) returns 204; larger than 25 MB returns 413. `GET /api/files/:id` returns the bytes or 404.
- Any other `/api/*` returns 404 JSON `{ "message": "..." }`.
- Any other GET serves the static folder, falling back to `index.html`.
- CORS allows `http://127.0.0.1:47411` and `http://localhost:47411`.

Shared sample payloads live in `test-vectors/entities.json`; a Rust test checks they round-trip byte for byte (2-space pretty JSON, field order as written).

## Crates

- `ow-core`: entity types, repository and file-store traits, errors. No I/O, no Tokio.
- `ow-store`: SQLite (sqlx) and disk implementations.
- `ow-server`: HTTP layer and composition root (`src/compose.rs`).

## Test

    cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test

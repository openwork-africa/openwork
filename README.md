![Openwork OSS showcase with Circle, Notes to self, profile cards, message composer, change feedback, and the digital sovereignty card](docs/components.png)

# Openwork

**An offline-first workspace for the people and operators you work with.**

[openwork.africa](https://openwork.africa)

## Why Openwork

We want to own our intelligence, our compute, and our conversations. Most of the technology we use is built and hosted outside Africa, so our data, our
insights and our spend leave with it. Openwork isn't fancy or different. It works like the chat apps you already know. What makes it different is the mission:
when someone realises they're running technology that doesn't have their interests at heart, they should have somewhere to switch to.

[Read the full why](docs/why.md).

## Getting started

Openwork currently has a Rust server and a TypeScript/React client. Deno manages the client workspace, checks, and test commands; Vite produces the browser
bundle. Rust builds and runs the server.

Install [Deno](https://deno.com) 2.9 and [Rust](https://rustup.rs) 1.88, then build and run the server from the repository root:

```sh
deno task build
cd server
cargo run -p ow-server -- --static ../app/dist
```

Open <http://127.0.0.1:47410>. The server keeps rooms, messages, and pictures in `server/data`; the page works offline and syncs when the server is available.

For local development, run the Rust API and the Vite client in separate terminals. Vite serves the app on port 47411 and proxies API requests to port 47410:

```sh
# Terminal 1, from the repository root
cd server && cargo run -p ow-server

# Terminal 2, from the repository root
cd app && deno task dev
```

Open <http://127.0.0.1:47411> while developing. After changing client code, rebuild with `deno task build` from the repository root.

Run the client checks from the repository root:

```sh
deno task check
deno task lint
deno task test
deno task fitness
```

Run the Rust server tests from `server/` with `cargo test`.

## How it is built

Openwork is a **frame** plus **plugins**. The frame (`packages/*`) is the three-pane shell: the Circle (the room list), the conversation window and the contact
panel. It owns the design and exposes named **slots**: places such as `circle.source`, `trail.body`, `trail.action` or `panel.section`. A plugin (`plugins/*`)
contributes data to a slot (a label, an icon, an order, a handler) and the frame draws it. A slot with nothing in it draws nothing.

What the app is made of is one file, `app/product.ts`: a list of plugins. This version ships `rooms`, `text` and `profile`. Taking one out of the list is the
whole uninstall; the rest still boots. A plugin can also open slots of its own for other plugins to fill. [docs/plugins.md](docs/plugins.md) shows how to write
one.

## Links

- Website: [openwork.africa](https://openwork.africa)
- Organization: [github.com/openwork-africa](https://github.com/openwork-africa)

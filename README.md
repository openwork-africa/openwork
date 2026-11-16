## Why Openwork

The goal is to eradicate Google Workspace, Microsoft Office 365, Slack, Teams, and every other tool we depend on but don't own. This is mainly about South Africa and Africa, because almost all the technology we use is hosted outside them. Openwork is a way to own our intelligence, our compute, and our conversations, for those who care about privacy.

Openwork isn't fancy or different. It works like the chat apps you already know. What makes it different is the mission: when someone realises they're running technology that doesn't have their interests at heart, they should have somewhere to switch to.

[Read the full why](docs/why.md).

![Openwork OSS showcase with Circle, Notes to self, profile cards, message composer, change feedback, and the digital sovereignty card](docs/components.png)

## Getting started

Openwork is a Rust server and a TypeScript/React client. Deno manages the client; Rust builds and runs the server.

### Requirements

- [Deno](https://deno.com) 2.9
- [Rust](https://rustup.rs) 1.88

### Run it

1. Clone the repository and go to its root:

   ```sh
   git clone https://github.com/openwork-africa/openwork.git
   cd openwork
   ```

2. Build the client:

   ```sh
   deno task build
   ```

3. Start the server:

   ```sh
   cd server
   cargo run -p ow-server -- --static ../app/dist
   ```

4. Open <http://127.0.0.1:47410>.

Rooms, messages, and pictures are saved in `server/data`. The page works offline and syncs when the server is available.

### Develop

1. In one terminal, start the server from the repository root:

   ```sh
   cd server && cargo run -p ow-server
   ```

2. In a second terminal, start the client from the repository root:

   ```sh
   cd app && deno task dev
   ```

3. Open <http://127.0.0.1:47411>. Vite serves the app and proxies API requests to port 47410.

### Check your changes

From the repository root:

```sh
deno task check
deno task lint
deno task test
deno task fitness
```

For the server, run `cargo test` from `server/`.

## Links

- Website: [openwork.africa](https://openwork.africa)
- Organization: [github.com/openwork-africa](https://github.com/openwork-africa)

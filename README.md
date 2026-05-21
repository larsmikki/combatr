# Combatr

Self-hosted D&D 5e encounter builder and combat tracker. Bundles SRD 5.1 monsters (CC BY 4.0) — no proprietary Monster Manual content.

## Stack

- **Client:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Server:** Node 20 + bare `http` + JSON file storage (no database)
- **Storage:** `data/combatr.json` (auto-created)

## Ports

| | Frontend (prod) | API (dev) |
|---|---|---|
| **Combatr** | 3050 | 3051 |

## Development

```sh
npm install
npm run dev
```

The Vite dev server runs on `:3050` and proxies `/api` to the Node server on `:3051`.

## Production

```sh
npm run build
npm start
```

The server serves the built client from `client/dist` and the API on the same port (3051 by default; set `PORT` to override).

## Data location

By default, data is written to `./data/combatr.json` relative to the working directory. Override with `COMBATR_DATA_FILE`.

## Content & licensing

This project includes material taken from the **System Reference Document 5.1** ("SRD 5.1") by Wizards of the Coast LLC, available under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

The repository does **not** bundle proprietary Monster Manual or adventure-module content. You can privately import your own legally owned monsters into your local instance via **Compendium → Import monsters** (JSON paste or file upload, single monster or array). Imported monsters are stored under `customMonsters` in `data/combatr.json` and stay on your server.
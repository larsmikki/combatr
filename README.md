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

## Getting started

Pick whichever install path matches your setup. All paths land on [http://localhost:3050](http://localhost:3050).

### 1. Docker (Docker Desktop, NAS, or any Docker server)

```bash
docker run -d \
  --name combatr \
  -p 3050:3050 \
  -v combatr-data:/app/data \
  --restart unless-stopped \
  larsmikki/combatr:latest
```

Or with Compose:

```yaml
services:
  combatr:
    image: larsmikki/combatr:latest
    container_name: combatr
    ports:
      - "3050:3050"
    volumes:
      - combatr-data:/app/data
    restart: unless-stopped

volumes:
  combatr-data:
```

### 2. Local install on Windows

Requires [Git for Windows](https://git-scm.com/download/win) and [Node.js 20+](https://nodejs.org/).

```powershell
git clone https://github.com/larsmikki/combatr.git
cd combatr
npm install
npm run dev
```

For a production build: `npm run build && npm start`.

### 3. Local install on macOS

```bash
brew install node git
git clone https://github.com/larsmikki/combatr.git
cd combatr
npm install
npm run dev
```

For a production build: `npm run build && npm start`.

### 4. Local install on Linux

Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

git clone https://github.com/larsmikki/combatr.git
cd combatr
npm install
npm run dev
```

On Fedora/RHEL use `dnf install nodejs git`; on Arch use `pacman -S nodejs npm git`.

For a production build: `npm run build && npm start`.

In dev, the Vite server runs on `:3050` and proxies `/api` to the Node server on `:3051`. In prod, both are served from `:3050`.

## Data location

By default, data is written to `./data/combatr.json` relative to the working directory. Override with `COMBATR_DATA_FILE`.

## Content & licensing

This project includes material taken from the **System Reference Document 5.1** ("SRD 5.1") by Wizards of the Coast LLC, available under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

The repository does **not** bundle proprietary Monster Manual or adventure-module content. You can privately import your own legally owned monsters into your local instance via **Compendium → Import monsters** (JSON paste or file upload, single monster or array). Imported monsters are stored under `customMonsters` in `data/combatr.json` and stay on your server.
# cbs-workflows

CDP Browser Session workflows for reusable browser automation over logged-in,
persistent sessions. CBS stands for CDP Browser Session.

## Dependency Layer

```text
product workflow
  -> cbs-workflows
    -> cdp-tools
```

`cdp-tools` owns browser discovery, CDP ports, profile roots, browser launch,
endpoint readiness, and low-level safety defaults. CBS owns app selection,
guided setup, manual-login handoff, Playwright verification, and reusable
session metadata.

Installing CBS from GitHub installs `cdp-tools` transitively. Users do not need
to clone another repository, modify PATH, or have `cdp-launch` preinstalled.

## Quick Start

```powershell
npm install
npm run browser:init -- -- --app chatgpt --browser chrome --auto-port --yes
```

Complete login in the opened work browser, return to the terminal, and press
Enter. CBS verifies the connection and saves a session under
`.browser-sessions/`. Browser profiles are stored outside the repository under
the portable profile root owned by `cdp-tools`.

Check running CDP endpoints:

```powershell
npm run browser:status
```

Verify a saved session:

```powershell
npm run browser:smoke -- -- --session-file .browser-sessions/chatgpt-chrome-9222.json
```

To register an already-running local CDP browser without launching another:

```powershell
npm run browser:init -- -- --app chatgpt --browser chrome --port 9222 --no-launch --no-wait --yes
```

## Install In Another Project

```powershell
npm install github:chianwu-hash/cbs-workflows
npx cbs-browser-init --app chatgpt --browser chrome --auto-port --yes
npx cbs-browser-status
```

## Public Modules

```js
const {
  readSessionConfig,
  verifyPlaywrightConnection,
} = require('cbs-workflows');
```

The lower-level adapter remains available as `cbs-workflows/cdp-tools-adapter`,
but product workflow repositories should normally use the CBS initializer and
session file instead of importing `cdp-tools` directly.

## Security

Do not commit browser profiles, session configs, cookies, tokens, `.env` files,
or screenshots containing private account data. Browser profile directories
must be treated as secrets.

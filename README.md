# cbs-workflows

CDP Browser Session workflows for reusable browser automation over logged-in, persistent sessions.

CBS stands for CDP Browser Session.

This repo was extracted from `browser-automation-workflow` so browser launch, login-session preparation, and Playwright CDP connectivity can be reused by higher-level projects such as Gemini, Canva, Google Drive, and NotebookLM workflows.

## Purpose

This repository provides the foundation layer for browser automation that depends on:

- a real Chrome, Edge, or Chromium browser
- a persistent browser profile / user data directory
- manual login performed by the operator
- Chrome DevTools Protocol remote debugging
- Playwright connecting to that browser through CDP
- reusable local session config files

It intentionally does not contain product-specific workflows, prompt sequences, presentation project data, or course content.

## Quick Start

Use from this repo directly:

Install dependencies:

```powershell
npm install
```

Prepare a logged-in browser session:

```powershell
npm run browser:init
```

## Install In Another Project

This package is not published to npm yet, but another local project can install it from GitHub:

```powershell
npm install github:chianwu-hash/cbs-workflows
```

Then run the initializer through `npx`:

```powershell
npx cbs-browser-init --app gemini --browser chrome --auto-port
```

Or import the module:

```js
const {
  readSessionConfig,
  verifyPlaywrightConnection,
} = require('cbs-workflows');
```

The initializer will ask for the target app, browser, debugging port, and profile directory. If you do not know which port to use, press Enter and it will find a free port starting from `9222`.

After the browser opens, log in to the target service. Return to PowerShell and press Enter. The script verifies Playwright can connect and writes a session config under `.browser-sessions/`.

On Windows / npm 11, pass flags with an extra separator:

```powershell
npm run browser:init -- -- --app gemini --browser chrome --auto-port
```

Direct Node invocation also works:

```powershell
node scripts/browser-session-setup.js --app canva --browser edge --port 9333 --yes
```

Verify an existing session:

```powershell
npm run browser:smoke -- -- --session-file .browser-sessions/gemini-chrome-9333.json
```

## Structure

- `lib/browser-session-init/`
  reusable browser/session initialization module
- `scripts/browser-session-setup.js`
  interactive and flag-based initializer
- `scripts/browser-smoke.js`
  minimal Playwright CDP connection check
- `docs/browser-session-init.md`
  detailed usage, config format, troubleshooting, and safety notes
- `docs/cbs-workflows.md`
  workflow foundation notes

## Session Config

Downstream workflows should read the generated JSON file and connect to `cdpUrl` with Playwright:

```js
const { chromium } = require('playwright');
const { readSessionConfig } = require('./lib/browser-session-init');

const session = readSessionConfig('.browser-sessions/gemini-chrome-9333.json');
const browser = await chromium.connectOverCDP(session.cdpUrl);
```

## Security

Do not commit browser profiles, session configs, cookies, tokens, `.env` files, or screenshots containing private account data.

The default ignored local paths are:

- `.browser-profiles/`
- `.browser-sessions/`
- `.env`
- `output/`
- `automation-output/`

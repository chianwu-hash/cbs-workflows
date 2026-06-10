# cbs-workflows

CDP Browser Session workflows for reusable browser automation over logged-in, persistent sessions.

CBS stands for CDP Browser Session.

This repo was extracted from `browser-automation-workflow` so browser launch, login-session preparation, and Playwright CDP connectivity can be reused by higher-level projects such as Gemini, Canva, Google Drive, and NotebookLM workflows.

## Current Safety Direction

For new work on this machine, use the shared CDP foundation first:

```powershell
cdp-launch chatgpt
cdp-status
```

The shared launcher and safe client live in:

```text
D:\projects\cdp-tools
```

This repo should become the guided workflow layer above `cdp-tools`: it can ask beginner-friendly questions, remember usable sessions, verify connection state, and continue to the real task. Browser launch, profile root, CDP URL policy, polling, screenshots, and low-level safety defaults should be owned by `cdp-tools`.

The current `browser:init` and `guided:start` launch paths are kept for compatibility while the repo is being refactored. Prefer `cdp-tools` for new browser sessions.

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

For a beginner-friendly guided flow in Traditional Chinese:

```powershell
npm run guided:cdp-tools
```

The older standalone launcher remains available as `npm run guided:start` for
compatibility while the workflow is being refactored.

## Guided Start For Teachers And General Users

If a teacher, student, or general user opens this project in VS Code with an AI assistant that can read the workspace and run terminal commands, they can start with this sentence:

```text
請開始 cbs-workflows
```

The expected experience is:

- the AI explains that it will open a dedicated work browser that AI can help operate
- the AI asks simple questions, one at a time
- the user answers with a number or short reply
- the AI launches the browser setup flow through `cdp-tools` when available
- the user logs in in the opened browser window
- the AI verifies the session and continues to the real task

Suggested teacher-facing instructions:

1. Open the `cbs-workflows` folder in VS Code.
2. Open your AI assistant panel inside VS Code.
3. Type `請開始 cbs-workflows`.
4. Follow the guided questions.
5. Log in when the browser opens.
6. Return to the AI chat and confirm login is complete.

The AI should preferably guide the user with plain-language questions such as:

- Which site do you want to use: Gemini, ChatGPT, Canva, Google Drive, or NotebookLM?
- Which browser do you want to use: Chrome or Edge?
- Do you want to create a new work browser or reuse a previous one?
- Have you finished signing in?

For this beginner-friendly flow, avoid exposing technical terms such as CDP, port, Playwright, or session file unless the user asks for more detail.

If you want a ready-to-paste AI assistant prompt for this guided flow, see `docs/ai-guided-start-prompt.md`.
For a Traditional Chinese teaching version, see `docs/ai-guided-start-prompt.zh-TW.md`.

To run the shared-launcher guided flow directly:

```powershell
npm run guided:cdp-tools
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

By default, successful sessions are saved so they can be reused later. If you are using a shared or temporary machine and do not want to add the browser session to the reusable session list, pass `--no-save`:

```powershell
node scripts/browser-session-setup.js --app gemini --browser chrome --auto-port --no-save
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

Login state is kept by the browser profile directory in `userDataDir`. The CDP port is only the live connection endpoint. If a saved browser is still open, workflows can reconnect to its `cdpUrl`; if it is closed, start Chrome or Edge again with the same `userDataDir` to reuse the logged-in account state.

To clear a saved login session, ask the AI assistant to clear the work browser sign-in state, or close the work browser and delete both the profile directory and its session config:

```powershell
Remove-Item -Recurse -Force .browser-profiles\gemini-chrome-9333
Remove-Item -Force .browser-sessions\gemini-chrome-9333.json
```

## Security

Do not commit browser profiles, session configs, cookies, tokens, `.env` files, or screenshots containing private account data.

The default ignored local paths are:

- `.browser-profiles/`
- `.browser-sessions/`
- `.env`
- `output/`
- `automation-output/`

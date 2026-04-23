# Browser Session Init

## Purpose

`browser-session-init` is the shared initialization layer for browser automation workflows.

It prepares a real Chrome, Edge, or Chromium browser session that can be reused by later modules such as Gemini, Canva, Google Drive, or NotebookLM automation.

This module owns only the browser/session foundation:

- choose or receive a remote debugging port
- find a free port when the operator does not know one
- create or reuse a persistent browser profile directory
- launch the browser with remote debugging enabled
- open the target service login URL
- let the operator log in manually
- verify Playwright can connect through CDP
- write a reusable session config file

It does not automate login, prompts, image generation, file export, or service-specific business logic.

## Files

- `lib/browser-session-init/index.js`
  reusable module functions
- `scripts/browser-session-setup.js`
  interactive CLI entry point
- `lib/session-setup.js`
  compatibility export for older imports

## Usage Flow

Install dependencies first:

```powershell
npm install
```

Run the interactive initializer:

```powershell
npm run browser:init
```

The script will ask for:

- target app, such as `gemini`, `canva`, or `drive`
- browser, such as `chrome` or `edge`
- remote debugging port
- browser profile / user data directory

If you do not know which port to use, press Enter at the port prompt. The script will find a free port starting at `9222`.

After the browser opens, sign in to the target service in that browser window. Return to PowerShell and press Enter. The script will verify Playwright CDP connectivity and write a session file under `.browser-sessions/`.

Common non-interactive examples:

```powershell
npm run browser:init -- -- --app gemini --browser chrome --auto-port --yes
```

```powershell
npm run browser:init -- -- --app canva --browser edge --port 9333 --yes
```

```powershell
npm run browser:init -- -- --app drive --browser chrome --port 9444 --user-data-dir .browser-profiles/drive-main --yes
```

To print the launch command and session file without launching a browser:

```powershell
npm run browser:init -- -- --app gemini --port 9333 --print-only --yes
```

The extra `--` after `npm run browser:init --` is intentional for Windows / npm 11 flag forwarding. Direct Node invocation also works:

```powershell
node scripts/browser-session-setup.js --app gemini --browser chrome --auto-port --yes
```

## Session Config Format

Session configs are local JSON files. They are intentionally ignored by git.

Example shape:

```json
{
  "schemaVersion": 1,
  "appId": "gemini",
  "appName": "Gemini",
  "loginUrl": "https://gemini.google.com/",
  "browserId": "chrome",
  "browserName": "Google Chrome",
  "browserPath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "port": 9333,
  "cdpUrl": "http://127.0.0.1:9333",
  "userDataDir": "C:\\Users\\user\\projects\\cbs-workflows\\.browser-profiles\\gemini-chrome-9333",
  "launchCommand": "'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 --user-data-dir='...'",
  "sessionFile": "C:\\Users\\user\\projects\\cbs-workflows\\.browser-sessions\\gemini-chrome-9333.json",
  "verifiedAt": "2026-04-23T00:00:00.000Z",
  "verification": {
    "connected": true,
    "contextCount": 1,
    "pageCount": 1,
    "urls": ["https://gemini.google.com/"]
  }
}
```

Downstream workflows should read `cdpUrl` from this file and connect with `chromium.connectOverCDP(cdpUrl)`.

## Windows / PowerShell Notes

The default profile path is inside the repo:

```text
.browser-profiles/<app>-<browser>-<port>
```

The default session config path is:

```text
.browser-sessions/<app>-<browser>-<port>.json
```

Both directories are ignored by git because they can contain cookies, login tokens, local storage, and account-specific state.

If Chrome or Edge cannot be found automatically, set an explicit browser path:

```powershell
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run browser:init -- -- --app gemini --browser chrome --port 9333
```

## Troubleshooting

### Port Is Already In Use

Choose another port or let the script find one:

```powershell
npm run browser:init -- -- --app gemini --auto-port
```

### Playwright Cannot Connect

Check that the browser was launched by this script or with matching flags:

```powershell
chrome.exe --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 --user-data-dir=".browser-profiles\gemini-chrome-9333"
```

Then verify:

```powershell
npm run browser:smoke -- -- --cdp-url http://127.0.0.1:9333
```

Or verify from a saved session file:

```powershell
npm run browser:smoke -- -- --session-file .browser-sessions/gemini-chrome-9333.json
```

### Login Is Missing In Later Runs

Make sure later runs reuse the same `userDataDir` or the same saved session config. A different profile directory is a different browser identity.

### Browser Opens But Target Site Is Not Logged In

Log in manually in the launched browser window. The module intentionally avoids automating credentials or two-factor prompts.

## Security Reminders

Do not commit:

- `.browser-profiles/`
- `.browser-sessions/`
- cookies
- tokens
- screenshots with private account data
- `.env` files
- downloaded private files

Treat browser profile directories as secrets. Anyone with the profile may be able to reuse the logged-in account session.

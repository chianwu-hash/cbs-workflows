# Browser Session Init

`browser-session-init` is the guided session layer between product workflows
and `cdp-tools`.

## Ownership

CBS owns:

- target application and login URL selection
- interactive or flag-based setup
- manual login handoff
- Playwright CDP verification
- reusable `.browser-sessions/*.json` metadata

`cdp-tools` owns:

- Chrome or Edge discovery
- local port validation and free-port selection
- portable persistent profile roots
- browser process launch
- CDP endpoint readiness
- low-level safety defaults

CBS must not spawn browsers with raw `--remote-debugging-port` arguments.

## Usage

```powershell
npm install
npm run browser:init -- -- --app chatgpt --browser chrome --auto-port --yes
```

To connect to an existing local CDP browser:

```powershell
npm run browser:init -- -- --app chatgpt --browser chrome --port 9222 --no-launch --no-wait --yes
```

To inspect endpoints or verify a saved session:

```powershell
npm run browser:status
npm run browser:smoke -- -- --session-file .browser-sessions/chatgpt-chrome-9222.json
```

## Session Shape

CBS writes schema version 2 session configs with `source: "cdp-tools"`, the
local `cdpUrl`, portable profile information, browser metadata, and Playwright
verification results. Downstream workflows should consume `cdpUrl` or the
session file and should not launch Chrome themselves.

## Profiles

The default profile root comes from `cdp-tools`:

- `CDP_PROFILE_ROOT`, when explicitly configured
- `%LOCALAPPDATA%\cdp-tools\profiles` on Windows
- `~/.local/share/cdp-tools/profiles` on other platforms

The session files remain under `.browser-sessions/` and are ignored by git.

## Security

Treat profile directories and session metadata as sensitive. Do not commit
profiles, session files, cookies, tokens, or private screenshots.

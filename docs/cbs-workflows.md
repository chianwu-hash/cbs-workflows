# CBS Workflows

## Core Idea

Many AI tools and browser-only services are easiest to automate after a human has already logged in.

CBS stands for CDP Browser Session. The workflow pattern in this repo is:

1. Launch a real browser with remote debugging enabled.
2. Store login state in a persistent browser profile.
3. Let the operator log in manually.
4. Reuse that browser session through CDP.
5. Verify Playwright can connect to the session.
6. Save a local session config for downstream workflows.

## Shared Concerns

### 1. Session Reuse

- Prefer connecting to an existing logged-in browser over automating login.
- Reuse the same profile when the workflow depends on account state, product memory, or conversation state.
- Treat the profile directory as sensitive local data.

### 2. CDP Connection

- Use a known remote debugging port.
- If the operator does not know a port, find a free one.
- Store the resulting `cdpUrl` in a session config file.

### 3. Browser Profiles

- Use a dedicated profile per service, account, or workflow family when possible.
- Do not reuse a normal daily browsing profile for automation unless you deliberately want that state.
- Keep `.browser-profiles/` out of git.

### 4. Evidence

- Save machine-readable session metadata.
- Let downstream workflows save screenshots and run logs when they perform service-specific actions.

### 5. Fallback Design

- Prefer layered checks over one brittle assumption.
- Separate "browser launched", "CDP is reachable", "Playwright connected", and "operator logged in" as distinct states.
- If a downstream platform is unstable, separate "task succeeded" from "download/export succeeded".

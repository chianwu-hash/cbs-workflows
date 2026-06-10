const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const {
  APPS,
  buildCdpUrl,
  defaultSessionFile,
  findFreePort,
  getAppConfig,
  verifyPlaywrightConnection,
  waitForCdpEndpoint,
  writeSessionConfig,
} = require('../browser-session-init');

const DEFAULT_CDP_TOOLS_ROOT = 'D:\\projects\\cdp-tools';
const DEFAULT_PROFILE_ROOT = 'D:\\chrome-cdp-profiles';

function sanitizeName(value) {
  const name = String(value || 'browser')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  if (!name) {
    throw new Error('CDP profile name cannot be empty.');
  }
  return name;
}

function resolveCdpLaunchPath(options = {}) {
  const explicit = options.cdpLaunchPath || process.env.CDP_LAUNCH_PATH;
  if (explicit) {
    return explicit;
  }

  const localScript = path.join(
    options.cdpToolsRoot || process.env.CDP_TOOLS_ROOT || DEFAULT_CDP_TOOLS_ROOT,
    'bin',
    'cdp-launch.ps1',
  );
  if (fs.existsSync(localScript)) {
    return localScript;
  }

  return 'cdp-launch';
}

function commandExists(command) {
  if (fs.existsSync(command)) {
    return true;
  }

  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `if (Get-Command ${JSON.stringify(command)} -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`,
  ], {
    shell: true,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function getAppUrl(appId) {
  return getAppConfig(appId).loginUrl;
}

async function resolveLaunchPort(options = {}) {
  const configured = options.port || process.env.CDP_PORT;
  if (configured) {
    return Number(configured);
  }
  return findFreePort();
}

function buildSessionConfigFromCdpTools(options = {}) {
  const app = getAppConfig(options.appId);
  const port = Number(options.port || process.env.CDP_PORT || 9222);
  const profileName = sanitizeName(options.profileName || app.id);
  const cdpUrl = buildCdpUrl(port);
  const sessionFile = options.sessionFile || defaultSessionFile({
    appId: app.id,
    browserId: 'cdp-tools',
    port,
  });

  return {
    schemaVersion: 2,
    source: 'cdp-tools',
    appId: app.id,
    appName: app.name,
    loginUrl: options.url || app.loginUrl,
    browserId: 'chrome',
    browserName: 'Google Chrome via cdp-tools',
    profileName,
    profileRoot: options.profileRoot || DEFAULT_PROFILE_ROOT,
    port,
    cdpUrl,
    sessionFile,
    createdAt: new Date().toISOString(),
  };
}

async function launchWithCdpTools(options = {}) {
  const app = getAppConfig(options.appId);
  const port = await resolveLaunchPort(options);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Invalid CDP port. Use an integer between 1024 and 65535.');
  }

  const profileName = sanitizeName(options.profileName || app.id);
  const cdpLaunchPath = resolveCdpLaunchPath(options);
  if (!commandExists(cdpLaunchPath)) {
    throw new Error(`cdp-launch was not found. Install or clone cdp-tools at ${DEFAULT_CDP_TOOLS_ROOT}, or put cdp-launch on PATH.`);
  }

  const cdpUrl = buildCdpUrl(port);
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    cdpLaunchPath,
    '-Name',
    profileName,
    '-Port',
    String(port),
    '-Url',
    options.url || app.loginUrl,
    '-ProfileRoot',
    options.profileRoot || DEFAULT_PROFILE_ROOT,
  ];

  const child = spawn('powershell.exe', args, {
    stdio: options.stdio || 'inherit',
    windowsHide: false,
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`cdp-launch failed with exit code ${exitCode}.`);
  }

  await waitForCdpEndpoint(cdpUrl);
  return buildSessionConfigFromCdpTools({
    ...options,
    appId: app.id,
    port,
    profileName,
  });
}

async function verifyAndSaveCdpToolsSession(options = {}) {
  const config = buildSessionConfigFromCdpTools(options);
  const verification = await verifyPlaywrightConnection(config.cdpUrl);
  const saved = {
    ...config,
    verifiedAt: new Date().toISOString(),
    verification,
  };
  writeSessionConfig(saved.sessionFile, saved);
  return saved;
}

module.exports = {
  APPS,
  DEFAULT_CDP_TOOLS_ROOT,
  DEFAULT_PROFILE_ROOT,
  buildSessionConfigFromCdpTools,
  commandExists,
  getAppUrl,
  launchWithCdpTools,
  resolveCdpLaunchPath,
  resolveLaunchPort,
  sanitizeName,
  verifyAndSaveCdpToolsSession,
};

const {
  defaultProfileRoot,
  launchCdpBrowser,
  resolveProfilePath,
} = require('cdp-tools');
const {
  APPS,
  buildCdpUrl,
  defaultSessionFile,
  findFreePort,
  getAppConfig,
  verifyPlaywrightConnection,
  writeSessionConfig,
} = require('../browser-session-init');

const DEFAULT_CDP_TOOLS_ROOT = null;
const DEFAULT_PROFILE_ROOT = defaultProfileRoot();

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
  return options.cdpLaunchPath || 'cdp-tools Node API';
}

function commandExists(command) {
  return command === 'cdp-tools Node API';
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
    userDataDir: resolveProfilePath(
      options.profileRoot || DEFAULT_PROFILE_ROOT,
      profileName,
    ).profilePath,
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
  const launched = await launchCdpBrowser({
    name: profileName,
    port,
    url: options.url || app.loginUrl,
    profileRoot: options.profileRoot || DEFAULT_PROFILE_ROOT,
    browserId: options.browserId || 'chrome',
    executablePath: options.executablePath,
    noLaunchIfRunning: options.noLaunchIfRunning,
  });
  return {
    ...buildSessionConfigFromCdpTools({
      ...options,
      appId: app.id,
      port,
      profileName,
    }),
    launchedPid: launched.pid,
    alreadyRunning: launched.alreadyRunning,
    browserPath: launched.browserPath,
    userDataDir: launched.profilePath,
  };
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

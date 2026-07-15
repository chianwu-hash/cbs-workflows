const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const {
  buildBrowserArgs: buildCdpBrowserArgs,
  buildCdpUrl,
  buildLaunchCommand: buildCdpLaunchCommand,
  defaultProfileRoot,
  findBrowserExecutable: findCdpBrowserExecutable,
  findFreePort,
  isPortFree,
  launchBrowserProcess,
  resolveProfilePath,
  waitForCdpEndpoint: waitForCdpEndpointCore,
} = require('cdp-tools');

const APPS = {
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    loginUrl: 'https://gemini.google.com/',
  },
  notebooklm: {
    id: 'notebooklm',
    name: 'NotebookLM',
    loginUrl: 'https://notebooklm.google.com/',
  },
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    loginUrl: 'https://chatgpt.com/',
  },
  canva: {
    id: 'canva',
    name: 'Canva',
    loginUrl: 'https://www.canva.com/',
  },
  drive: {
    id: 'drive',
    name: 'Google Drive',
    loginUrl: 'https://drive.google.com/',
  },
};

const BROWSERS = {
  chrome: {
    id: 'chrome',
    name: 'Google Chrome',
    envVar: 'CHROME_PATH',
    commandNames: ['chrome.exe', 'chrome'],
    windowsPaths: [
      'Google\\Chrome\\Application\\chrome.exe',
    ],
  },
  edge: {
    id: 'edge',
    name: 'Microsoft Edge',
    envVar: 'EDGE_PATH',
    commandNames: ['msedge.exe', 'msedge'],
    windowsPaths: [
      'Microsoft\\Edge\\Application\\msedge.exe',
    ],
  },
  chromium: {
    id: 'chromium',
    name: 'Chromium',
    envVar: 'CHROMIUM_PATH',
    commandNames: ['chromium.exe', 'chromium'],
    windowsPaths: [],
  },
};

function isValidPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

function normalizePort(value) {
  if (!isValidPort(value)) {
    throw new Error('Invalid port. Use an integer between 1024 and 65535.');
  }
  return Number(value);
}

function getAppConfig(appId = 'gemini') {
  return APPS[appId] || APPS.gemini;
}

function getBrowserConfig(browserId = 'chrome') {
  return BROWSERS[browserId] || BROWSERS.chrome;
}

function findBrowserExecutable(browserId = 'chrome') {
  if (browserId === 'chromium') {
    const playwrightChromium = chromium.executablePath();
    if (playwrightChromium && fs.existsSync(playwrightChromium)) return playwrightChromium;
  }
  return findCdpBrowserExecutable(browserId);
}

function defaultUserDataDir({ appId, browserId, port }) {
  const safeApp = String(appId || 'app').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const safeBrowser = String(browserId || 'browser').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return resolveProfilePath(defaultProfileRoot(), `${safeApp}-${safeBrowser}-${port}`).profilePath;
}

function defaultSessionFile({ appId, browserId, port, cwd = process.cwd() }) {
  const safeApp = String(appId || 'app').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const safeBrowser = String(browserId || 'browser').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return path.resolve(cwd, '.browser-sessions', `${safeApp}-${safeBrowser}-${port}.json`);
}

function assertLocalCdpUrl(cdpUrl) {
  let parsed;
  try {
    parsed = new URL(cdpUrl);
  } catch (error) {
    throw new Error(`Invalid CDP URL: ${cdpUrl}`);
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(`Refusing non-local CDP URL: ${cdpUrl}. Use 127.0.0.1 or localhost.`);
  }
}

function buildBrowserArgs({ port, userDataDir, loginUrl }) {
  return buildCdpBrowserArgs({
    port,
    profilePath: userDataDir,
    url: loginUrl,
  });
}

function buildLaunchCommand({ browserPath, port, userDataDir, loginUrl }) {
  return buildCdpLaunchCommand({
    browserPath,
    port,
    profilePath: userDataDir,
    url: loginUrl,
  });
}

function launchBrowser({ browserPath, port, userDataDir, loginUrl }) {
  return launchBrowserProcess({
    browserPath,
    port,
    profilePath: userDataDir,
    url: loginUrl,
  }).pid;
}

async function waitForCdpEndpoint(cdpUrl, timeoutMs = 15000) {
  assertLocalCdpUrl(cdpUrl);
  return waitForCdpEndpointCore(cdpUrl, timeoutMs);
}

async function verifyPlaywrightConnection(cdpUrl) {
  assertLocalCdpUrl(cdpUrl);
  const browser = await chromium.connectOverCDP(cdpUrl);
  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('No browser context found after connecting over CDP.');
    }
    return {
      connected: true,
      contextCount: browser.contexts().length,
      pageCount: context.pages().length,
      urls: context.pages().map((page) => page.url()),
    };
  } finally {
    await disconnectPlaywrightBrowser(browser);
  }
}

async function disconnectPlaywrightBrowser(browser) {
  if (browser && typeof browser.disconnect === 'function') {
    await browser.disconnect();
    return;
  }
  if (browser && typeof browser.close === 'function') {
    await browser.close();
  }
}

function buildSessionConfig(options) {
  const app = getAppConfig(options.appId);
  const browser = getBrowserConfig(options.browserId);
  const port = normalizePort(options.port);
  const cdpUrl = buildCdpUrl(port);
  const userDataDir = path.resolve(options.userDataDir);
  const browserPath = options.browserPath || findBrowserExecutable(browser.id);

  return {
    schemaVersion: 2,
    source: 'cdp-tools',
    appId: app.id,
    appName: app.name,
    loginUrl: options.loginUrl || app.loginUrl,
    browserId: browser.id,
    browserName: browser.name,
    browserPath,
    port,
    cdpUrl,
    userDataDir,
    profileRoot: path.dirname(userDataDir),
    createdAt: new Date().toISOString(),
    platform: os.platform(),
    launchCommand: buildLaunchCommand({
      browserPath,
      port,
      userDataDir,
      loginUrl: options.loginUrl || app.loginUrl,
    }),
  };
}

function writeSessionConfig(sessionFile, config) {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  fs.writeFileSync(sessionFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function readSessionConfig(sessionFile) {
  const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  if (session.cdpUrl) {
    assertLocalCdpUrl(session.cdpUrl);
  }
  return session;
}

module.exports = {
  APPS,
  BROWSERS,
  assertLocalCdpUrl,
  buildBrowserArgs,
  buildCdpUrl,
  buildLaunchCommand,
  buildSessionConfig,
  defaultSessionFile,
  defaultUserDataDir,
  disconnectPlaywrightBrowser,
  findBrowserExecutable,
  findFreePort,
  getAppConfig,
  getBrowserConfig,
  isPortFree,
  isValidPort,
  launchBrowser,
  readSessionConfig,
  verifyPlaywrightConnection,
  waitForCdpEndpoint,
  writeSessionConfig,
};

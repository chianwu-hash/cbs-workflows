const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

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

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort(startPort = 9222, host = '127.0.0.1', attempts = 50) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset;
    if (await isPortFree(port, host)) {
      return port;
    }
  }
  throw new Error(`Could not find a free port starting from ${startPort}.`);
}

function getAppConfig(appId = 'gemini') {
  return APPS[appId] || APPS.gemini;
}

function getBrowserConfig(browserId = 'chrome') {
  return BROWSERS[browserId] || BROWSERS.chrome;
}

function pathExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}

function candidateWindowsPaths(browserConfig) {
  const roots = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);

  const candidates = [];
  for (const root of roots) {
    for (const relativePath of browserConfig.windowsPaths) {
      candidates.push(path.join(root, relativePath));
    }
  }
  return candidates;
}

function findBrowserExecutable(browserId = 'chrome') {
  const browserConfig = getBrowserConfig(browserId);
  const envPath = process.env[browserConfig.envVar];
  if (pathExists(envPath)) return envPath;

  if (browserId === 'chromium') {
    const playwrightChromium = chromium.executablePath();
    if (pathExists(playwrightChromium)) return playwrightChromium;
  }

  for (const candidate of candidateWindowsPaths(browserConfig)) {
    if (pathExists(candidate)) return candidate;
  }

  return browserConfig.commandNames[0];
}

function defaultUserDataDir({ appId, browserId, port, cwd = process.cwd() }) {
  const safeApp = String(appId || 'app').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const safeBrowser = String(browserId || 'browser').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return path.resolve(cwd, '.browser-profiles', `${safeApp}-${safeBrowser}-${port}`);
}

function defaultSessionFile({ appId, browserId, port, cwd = process.cwd() }) {
  const safeApp = String(appId || 'app').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const safeBrowser = String(browserId || 'browser').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return path.resolve(cwd, '.browser-sessions', `${safeApp}-${safeBrowser}-${port}.json`);
}

function buildCdpUrl(port, host = '127.0.0.1') {
  return `http://${host}:${port}`;
}

function buildBrowserArgs({ port, userDataDir, loginUrl }) {
  const args = [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--new-window',
  ];

  if (loginUrl) {
    args.push(loginUrl);
  }

  return args;
}

function quotePowerShellArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=?-]+$/.test(text)) {
    return text;
  }
  return `'${text.replace(/'/g, "''")}'`;
}

function buildLaunchCommand({ browserPath, port, userDataDir, loginUrl }) {
  const args = buildBrowserArgs({ port, userDataDir, loginUrl }).map(quotePowerShellArg);
  return `${quotePowerShellArg(browserPath)} ${args.join(' ')}`;
}

function launchBrowser({ browserPath, port, userDataDir, loginUrl }) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const args = buildBrowserArgs({ port, userDataDir, loginUrl });
  const child = spawn(browserPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  return child.pid;
}

function readJsonFromUrl(url, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Timed out reading ${url}.`));
    });
    request.on('error', reject);
  });
}

async function waitForCdpEndpoint(cdpUrl, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  const versionUrl = `${cdpUrl.replace(/\/$/, '')}/json/version`;
  let lastError;

  while (Date.now() < deadline) {
    try {
      return await readJsonFromUrl(versionUrl);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`CDP endpoint did not become ready at ${versionUrl}. Last error: ${lastError.message}`);
}

async function verifyPlaywrightConnection(cdpUrl) {
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
    schemaVersion: 1,
    appId: app.id,
    appName: app.name,
    loginUrl: options.loginUrl || app.loginUrl,
    browserId: browser.id,
    browserName: browser.name,
    browserPath,
    port,
    cdpUrl,
    userDataDir,
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
  return JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
}

module.exports = {
  APPS,
  BROWSERS,
  buildBrowserArgs,
  buildCdpUrl,
  buildLaunchCommand,
  buildSessionConfig,
  defaultSessionFile,
  defaultUserDataDir,
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

const path = require('path');
const readline = require('readline');
const {
  APPS,
  BROWSERS,
  buildSessionConfig,
  defaultSessionFile,
  defaultUserDataDir,
  findFreePort,
  isPortFree,
  isValidPort,
  launchBrowser,
  verifyPlaywrightConnection,
  waitForCdpEndpoint,
  writeSessionConfig,
} = require('../lib/browser-session-init');

function parseArgs(argv) {
  const options = {
    app: 'gemini',
    browser: 'chrome',
    port: null,
    autoPort: false,
    userDataDir: '',
    sessionFile: '',
    loginUrl: '',
    launch: true,
    waitForLogin: true,
    verify: true,
    json: false,
    assumeYes: false,
    appProvided: false,
    browserProvided: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app' && argv[i + 1]) {
      options.app = argv[++i].toLowerCase();
      options.appProvided = true;
    } else if (arg === '--browser' && argv[i + 1]) {
      options.browser = argv[++i].toLowerCase();
      options.browserProvided = true;
    } else if (arg === '--port' && argv[i + 1]) {
      options.port = Number(argv[++i]);
    } else if (arg === '--auto-port') {
      options.autoPort = true;
    } else if (arg === '--user-data-dir' && argv[i + 1]) {
      options.userDataDir = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--session-file' && argv[i + 1]) {
      options.sessionFile = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === '--login-url' && argv[i + 1]) {
      options.loginUrl = argv[++i];
    } else if (arg === '--print-only' || arg === '--no-launch') {
      options.launch = false;
      options.waitForLogin = false;
      options.verify = false;
    } else if (arg === '--no-wait') {
      options.waitForLogin = false;
    } else if (arg === '--no-verify') {
      options.verify = false;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.assumeYes = true;
    }
  }

  return options;
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function chooseFromMap(rl, label, map, currentValue) {
  const ids = Object.keys(map);
  const prompt = ids.map((id, index) => `${index + 1}:${id}`).join(', ');
  const answer = (await ask(rl, `${label} [${prompt}] (default: ${currentValue}): `)).trim().toLowerCase();
  if (!answer) return currentValue;
  if (map[answer]) return answer;

  const index = Number(answer);
  if (Number.isInteger(index) && index >= 1 && index <= ids.length) {
    return ids[index - 1];
  }

  return currentValue;
}

async function chooseApp(rl, options) {
  if ((options.appProvided || options.assumeYes) && APPS[options.app]) {
    return options.app;
  }
  return chooseFromMap(rl, 'Choose app', APPS, options.app);
}

async function chooseBrowser(rl, options) {
  if ((options.browserProvided || options.assumeYes) && BROWSERS[options.browser]) {
    return options.browser;
  }
  return chooseFromMap(rl, 'Choose browser', BROWSERS, options.browser);
}

async function choosePort(rl, presetPort, autoPort, assumeYes = false, requireFree = true) {
  if (isValidPort(presetPort)) {
    const port = Number(presetPort);
    const free = await isPortFree(port);
    if (requireFree && !free) {
      throw new Error(`Port ${presetPort} is already in use. Choose another port or close the existing browser.`);
    }
    return port;
  }

  if (autoPort || assumeYes) {
    return findFreePort();
  }

  const answer = (await ask(
    rl,
    'Enter remote debugging port, or press Enter to pick a free port starting from 9222: '
  )).trim();

  if (!answer) {
    return findFreePort();
  }

  if (!isValidPort(answer)) {
    throw new Error('Invalid port. Use an integer between 1024 and 65535.');
  }

  const port = Number(answer);
  const free = await isPortFree(port);
  if (!free) {
    throw new Error(`Port ${port} is already in use. Run again and choose another port.`);
  }

  return port;
}

async function chooseUserDataDir(rl, presetDir, defaults, assumeYes = false) {
  if (presetDir) {
    return path.resolve(process.cwd(), presetDir);
  }

  const defaultDir = defaultUserDataDir(defaults);
  if (assumeYes) {
    return defaultDir;
  }

  const answer = (await ask(
    rl,
    `Browser profile / user data dir (default: ${defaultDir}): `
  )).trim();

  return answer ? path.resolve(process.cwd(), answer) : defaultDir;
}

async function waitForLogin(rl, appName) {
  console.log('');
  console.log(`Sign in to ${appName} in the browser window that just opened.`);
  console.log('When the page is fully logged in and ready, return here and press Enter.');
  await ask(rl, 'Press Enter after login: ');
}

function printHumanSummary(summary, sessionFile, verification) {
  console.log('');
  console.log(`App: ${summary.appName}`);
  console.log(`Login URL: ${summary.loginUrl}`);
  console.log(`Browser: ${summary.browserName}`);
  console.log(`Port: ${summary.port}`);
  console.log(`CDP URL: ${summary.cdpUrl}`);
  console.log(`User data dir: ${summary.userDataDir}`);
  console.log(`Session file: ${sessionFile}`);
  console.log('');
  console.log('Launch command:');
  console.log(`  ${summary.launchCommand}`);

  if (verification) {
    console.log('');
    console.log(`Playwright verified: ${verification.connected ? 'yes' : 'no'}`);
    console.log(`Open pages: ${verification.pageCount}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rl = createInterface();

  try {
    const app = await chooseApp(rl, options);
    const browser = await chooseBrowser(rl, options);
    const port = await choosePort(rl, options.port, options.autoPort, options.assumeYes, options.launch);
    const userDataDir = await chooseUserDataDir(rl, options.userDataDir, {
      appId: app,
      browserId: browser,
      port,
    }, options.assumeYes);
    const sessionFile = options.sessionFile || defaultSessionFile({
      appId: app,
      browserId: browser,
      port,
    });

    const summary = buildSessionConfig({
      appId: app,
      browserId: browser,
      port,
      userDataDir,
      loginUrl: options.loginUrl || undefined,
    });

    let launchedPid = null;
    if (options.launch) {
      launchedPid = launchBrowser(summary);
      await waitForCdpEndpoint(summary.cdpUrl);
    }

    if (options.waitForLogin) {
      await waitForLogin(rl, summary.appName);
    }

    let verification = null;
    if (options.verify) {
      verification = await verifyPlaywrightConnection(summary.cdpUrl);
    }

    const config = {
      ...summary,
      sessionFile,
      launchedPid,
      verifiedAt: verification ? new Date().toISOString() : null,
      verification,
    };

    writeSessionConfig(sessionFile, config);

    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    printHumanSummary(config, sessionFile, verification);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

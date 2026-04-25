#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {
  APPS,
  BROWSERS,
  buildSessionConfig,
  defaultSessionFile,
  defaultUserDataDir,
  findFreePort,
  launchBrowser,
  readSessionConfig,
  verifyPlaywrightConnection,
  waitForCdpEndpoint,
  writeSessionConfig,
} = require('../lib/browser-session-init');

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function chooseOption(rl, title, options) {
  console.log('');
  console.log(title);
  for (const option of options) {
    console.log(`${option.id}. ${option.label}`);
  }

  while (true) {
    const answer = (await ask(rl, '請輸入數字：')).trim();
    const selected = options.find((option) => String(option.id) === answer);
    if (selected) {
      return selected;
    }
    console.log('我沒有看懂這個選項，請再輸入一次。');
  }
}

async function waitForEnter(rl, question) {
  await ask(rl, question);
}

function listSavedSessions(cwd = process.cwd()) {
  const sessionsDir = path.resolve(cwd, '.browser-sessions');
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  const files = fs.readdirSync(sessionsDir)
    .filter((name) => name.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  const sessions = [];
  for (const file of files) {
    const sessionPath = path.join(sessionsDir, file);
    try {
      const session = readSessionConfig(sessionPath);
      sessions.push({
        file,
        path: sessionPath,
        session,
      });
    } catch (error) {
      // Skip unreadable session files so one bad file does not block the flow.
    }
  }

  return sessions;
}

function printWelcome() {
  console.log('我會幫你開啟一個可供 AI 協助操作的工作瀏覽器。');
  console.log('不用擔心技術名詞，我會一步一步帶你完成。');
}

function printSuccess(config, verification) {
  console.log('');
  console.log('已確認成功，你的工作瀏覽器已準備完成。');
  console.log(`網站：${config.appName}`);
  console.log(`瀏覽器：${config.browserName}`);
  console.log(`設定檔：${config.sessionFile}`);
  console.log(`目前開啟頁數：${verification.pageCount}`);
  console.log('');
  console.log('接下來你可以直接對 AI 說你想做的事，例如：');
  console.log('- 幫我開始使用這個網站');
  console.log('- 幫我整理這個頁面的內容');
  console.log('- 幫我做接下來的瀏覽器操作');
}

async function createNewSession(rl) {
  const appChoices = Object.values(APPS).map((app, index) => ({
    id: index + 1,
    value: app.id,
    label: app.name,
  }));
  const browserChoices = [
    { id: 1, value: 'chrome', label: BROWSERS.chrome.name },
    { id: 2, value: 'edge', label: BROWSERS.edge.name },
  ];

  const appChoice = await chooseOption(rl, '先選你這次要在哪個網站工作：', appChoices);
  const browserChoice = await chooseOption(rl, '接著請選你要使用的瀏覽器：', browserChoices);

  console.log('');
  console.log('接下來我會幫你開啟一個新的工作瀏覽器。');
  console.log('它會和你平常使用的瀏覽器分開，比較適合做自動化工作。');
  console.log('我會自動幫你選擇可用的連線設定。');

  const startChoice = await chooseOption(rl, '準備好後請選擇：', [
    { id: 1, value: 'start', label: '開始' },
    { id: 2, value: 'cancel', label: '先不要' },
  ]);

  if (startChoice.value === 'cancel') {
    console.log('這次先不啟動工作瀏覽器。你之後再執行一次就可以。');
    return;
  }

  const port = await findFreePort();
  const userDataDir = defaultUserDataDir({
    appId: appChoice.value,
    browserId: browserChoice.value,
    port,
  });
  const sessionFile = defaultSessionFile({
    appId: appChoice.value,
    browserId: browserChoice.value,
    port,
  });

  const summary = buildSessionConfig({
    appId: appChoice.value,
    browserId: browserChoice.value,
    port,
    userDataDir,
  });

  const launchedPid = launchBrowser(summary);
  await waitForCdpEndpoint(summary.cdpUrl);

  console.log('');
  console.log(`我已開啟 ${summary.appName} 的工作瀏覽器。`);
  console.log('請在新開啟的瀏覽器視窗中完成登入。');

  const loginChoice = await chooseOption(rl, '登入完成後，請回到這裡選擇：', [
    { id: 1, value: 'done', label: '我已完成登入' },
    { id: 2, value: 'wait', label: '還沒完成' },
  ]);

  if (loginChoice.value === 'wait') {
    await waitForEnter(rl, '請完成登入後按 Enter 繼續。');
  }

  console.log('');
  console.log('我現在幫你確認這個工作瀏覽器是否已經可以使用，請稍等。');
  const verification = await verifyPlaywrightConnection(summary.cdpUrl);

  const config = {
    ...summary,
    sessionFile,
    launchedPid,
    verifiedAt: new Date().toISOString(),
    verification,
  };

  writeSessionConfig(sessionFile, config);
  printSuccess(config, verification);
}

async function chooseSavedSession(rl, sessions) {
  if (sessions.length === 0) {
    return null;
  }

  if (sessions.length === 1) {
    const only = sessions[0];
    const choice = await chooseOption(
      rl,
      `我找到一個之前建立過的工作瀏覽器：${only.session.appName} / ${only.session.browserName}`,
      [
        { id: 1, value: 'use', label: '使用這個工作瀏覽器' },
        { id: 2, value: 'create', label: '改成建立新的工作瀏覽器' },
      ]
    );
    return choice.value === 'use' ? only : null;
  }

  const options = sessions.map((item, index) => ({
    id: index + 1,
    value: item.path,
    label: `${item.session.appName} / ${item.session.browserName}`,
  }));
  options.push({
    id: options.length + 1,
    value: '__create_new__',
    label: '建立新的工作瀏覽器',
  });

  const choice = await chooseOption(rl, '我找到多個之前建立過的工作瀏覽器，請選擇：', options);
  if (choice.value === '__create_new__') {
    return null;
  }
  return sessions.find((item) => item.path === choice.value) || null;
}

async function reuseSavedSession(rl) {
  const sessions = listSavedSessions();
  if (sessions.length === 0) {
    console.log('');
    console.log('我目前沒有找到之前建立過的工作瀏覽器。');
    return createNewSession(rl);
  }

  const selected = await chooseSavedSession(rl, sessions);
  if (!selected) {
    return createNewSession(rl);
  }

  console.log('');
  console.log('我現在幫你確認這個工作瀏覽器是否仍可使用，請稍等。');

  try {
    const verification = await verifyPlaywrightConnection(selected.session.cdpUrl);
    const updatedConfig = {
      ...selected.session,
      verifiedAt: new Date().toISOString(),
      verification,
    };
    writeSessionConfig(selected.path, updatedConfig);
    printSuccess(updatedConfig, verification);
  } catch (error) {
    console.log('');
    console.log('我找到之前的工作瀏覽器設定，但目前無法順利連線。');
    console.log('這通常表示瀏覽器已經關閉，或這個工作瀏覽器需要重新建立。');

    const nextChoice = await chooseOption(rl, '你想怎麼做？', [
      { id: 1, value: 'create', label: '重新建立新的工作瀏覽器' },
      { id: 2, value: 'cancel', label: '先取消' },
    ]);

    if (nextChoice.value === 'create') {
      return createNewSession(rl);
    }

    console.log('這次先不繼續。你之後可以再執行一次。');
  }
}

async function main() {
  const rl = createInterface();
  try {
    printWelcome();

    const flowChoice = await chooseOption(rl, '你想要怎麼開始？', [
      { id: 1, value: 'new', label: '建立新的工作瀏覽器' },
      { id: 2, value: 'reuse', label: '使用之前的工作瀏覽器' },
    ]);

    if (flowChoice.value === 'new') {
      await createNewSession(rl);
      return;
    }

    await reuseSavedSession(rl);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

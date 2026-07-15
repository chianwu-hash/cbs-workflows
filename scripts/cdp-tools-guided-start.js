#!/usr/bin/env node

const readline = require('readline');
const {
  APPS,
  buildSessionConfigFromCdpTools,
  launchWithCdpTools,
  resolveCdpLaunchPath,
  resolveLaunchPort,
  verifyAndSaveCdpToolsSession,
} = require('../lib/cdp-tools-adapter');

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

function printWelcome() {
  console.log('我會用 cdp-tools 幫你開啟一個可供 AI 協助操作的工作瀏覽器。');
  console.log('這個流程會使用已安裝的共用安全底座，瀏覽器資料會放在使用者專屬的 profile 目錄。');
}

function printSuccess(config) {
  console.log('');
  console.log('已確認成功，你的工作瀏覽器已準備完成。');
  console.log(`網站：${config.appName}`);
  console.log(`CDP：${config.cdpUrl}`);
  console.log(`工作瀏覽器名稱：${config.profileName}`);
  console.log(`設定檔：${config.sessionFile}`);
  console.log('');
  console.log('接下來你可以請 AI 協助整理頁面、使用網頁版 AI 工具，或準備下一步操作。');
  console.log('正式送出、刪除、寄信、公告、匯入或寫入系統前，請先停下來確認。');
}

async function main() {
  const rl = createInterface();
  try {
    printWelcome();

    const apps = Object.values(APPS).map((app, index) => ({
      id: index + 1,
      value: app.id,
      label: app.name,
    }));

    const appChoice = await chooseOption(rl, '先選你這次要在哪個網站工作：', apps);
    const launchPath = resolveCdpLaunchPath();
    const port = await resolveLaunchPort();
    const preview = buildSessionConfigFromCdpTools({
      appId: appChoice.value,
      profileName: appChoice.value,
      port,
    });

    console.log('');
    console.log('我會使用這個 shared launcher API：');
    console.log(launchPath);
    console.log('');
    console.log('準備開啟工作瀏覽器：');
    console.log(`- 網站：${preview.appName}`);
    console.log(`- 工作瀏覽器名稱：${preview.profileName}`);
    console.log(`- CDP：${preview.cdpUrl}`);

    const startChoice = await chooseOption(rl, '準備好後請選擇：', [
      { id: 1, value: 'start', label: '開始' },
      { id: 2, value: 'cancel', label: '先不要' },
    ]);

    if (startChoice.value === 'cancel') {
      console.log('這次先不啟動工作瀏覽器。');
      return;
    }

    const config = await launchWithCdpTools({
      appId: appChoice.value,
      profileName: appChoice.value,
      port,
    });

    console.log('');
    console.log(`我已開啟 ${config.appName} 的工作瀏覽器。`);
    console.log('請在新開啟的瀏覽器視窗中完成登入。');
    await waitForEnter(rl, '登入完成後，請回到這裡按 Enter 繼續。');

    console.log('');
    console.log('我現在幫你確認這個工作瀏覽器是否已經可以使用，請稍等。');
    const saved = await verifyAndSaveCdpToolsSession(config);
    printSuccess(saved);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

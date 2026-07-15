const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function collect(relativeDir) {
  const dir = path.join(root, relativeDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDir, entry.name);
    return entry.isDirectory() ? collect(relative) : entry.name.endsWith('.js') ? [relative] : [];
  });
}

let failed = false;
for (const file of ['index.js', ...collect('lib'), ...collect('scripts')].sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);

const cdpTools = require('cdp-tools');
const cbs = require('../lib/browser-session-init');
const profile = cbs.defaultUserDataDir({ appId: 'chatgpt', browserId: 'chrome', port: 9222 });
if (!profile.startsWith(cdpTools.defaultProfileRoot())) {
  throw new Error('CBS profile path is not owned by cdp-tools.');
}
const session = cbs.buildSessionConfig({
  appId: 'chatgpt',
  browserId: 'chrome',
  port: 9222,
  userDataDir: profile,
});
if (session.source !== 'cdp-tools') {
  throw new Error('CBS session config is not marked as cdp-tools-backed.');
}
console.log('cbs-workflows checks passed.');

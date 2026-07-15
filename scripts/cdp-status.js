#!/usr/bin/env node

const { getCdpStatus } = require('cdp-tools');

function parsePorts(argv) {
  const index = argv.findIndex((arg) => arg === '--ports');
  if (index === -1 || !argv[index + 1]) return [9222, 9223, 9333];
  return argv[index + 1].split(',').map((value) => Number(value.trim()));
}

async function main() {
  const results = await getCdpStatus({ ports: parsePorts(process.argv.slice(2)) });
  console.log(JSON.stringify(results, null, 2));
  if (!results.some((item) => item.reachable)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

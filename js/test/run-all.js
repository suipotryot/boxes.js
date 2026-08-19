// Runs every *.test.js in this directory sequentially (each file calls
// process.exit(1) on its own failures, so a non-zero exit here means at
// least one suite failed).
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();

let failed = false;
for (const file of files) {
  console.log(`\n--- ${file} ---`);
  const result = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);

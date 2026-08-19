// Zero-dependency test harness. Run any *.test.js file directly with node
// (native ES module support, no build step, no install).
const tests = [];
let failures = 0;

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function assertClose(actual, expected, epsilon = 1e-6, msg = '') {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${msg} expected ${expected}, got ${actual}`);
  }
}

export function run() {
  for (const { name, fn } of tests) {
    try {
      fn();
      console.log(`  ok  ${name}`);
    } catch (err) {
      failures++;
      console.error(`FAIL  ${name}`);
      console.error(`      ${err.message}`);
    }
  }
  console.log(`${tests.length - failures}/${tests.length} passed`);
  if (failures > 0) process.exit(1);
}

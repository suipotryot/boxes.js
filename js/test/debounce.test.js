import { test, assert, run } from './testHarness.js';
import { debounce } from '../state/debounce.js';

function fakeScheduler() {
  const scheduled = [];
  const scheduler = (fn, ms) => scheduled.push({ fn, ms });
  return { scheduler, scheduled };
}

test('call() does not invoke fn synchronously', () => {
  let calls = 0;
  const { scheduler } = fakeScheduler();
  const d = debounce(() => calls++, 100, scheduler);
  d.call();
  assert(calls === 0, 'fn should not run before the scheduler fires');
});

test("call() invokes fn once the scheduler's callback fires, with the call's arguments", () => {
  const seen = [];
  const { scheduler, scheduled } = fakeScheduler();
  const d = debounce((...args) => seen.push(args), 100, scheduler);
  d.call(1, 2);
  scheduled[0].fn();
  assert(seen.length === 1 && seen[0][0] === 1 && seen[0][1] === 2, 'fn should run once with the call args');
});

test('rapid repeated calls only run fn once, using the arguments from the last call', () => {
  const seen = [];
  const { scheduler, scheduled } = fakeScheduler();
  const d = debounce((...args) => seen.push(args), 100, scheduler);
  d.call('a');
  d.call('b');
  d.call('c');
  // Simulate every stale scheduled callback still firing (no real
  // clearTimeout happened) — only the last one should actually run fn.
  for (const s of scheduled) s.fn();
  assert(seen.length === 1, `expected fn to run exactly once, got ${seen.length}`);
  assert(seen[0][0] === 'c', `expected the last call's args ('c'), got '${seen[0][0]}'`);
});

test('each call schedules with the configured delay', () => {
  const { scheduler, scheduled } = fakeScheduler();
  const d = debounce(() => {}, 250, scheduler);
  d.call();
  d.call();
  assert(scheduled.every((s) => s.ms === 250), 'every scheduled entry should use the configured delay');
});

test('flush() invokes immediately without waiting for the scheduler', () => {
  let calls = 0;
  const { scheduler } = fakeScheduler();
  const d = debounce(() => calls++, 100, scheduler);
  d.call();
  d.flush();
  assert(calls === 1, 'flush() should run fn right away');
});

test('flush() with nothing pending is a no-op', () => {
  let calls = 0;
  const { scheduler } = fakeScheduler();
  const d = debounce(() => calls++, 100, scheduler);
  d.flush();
  assert(calls === 0, 'flush() should not invoke fn when nothing is pending');
});

test('flush() after the scheduler already ran the call does not invoke fn again', () => {
  let calls = 0;
  const { scheduler, scheduled } = fakeScheduler();
  const d = debounce(() => calls++, 100, scheduler);
  d.call();
  scheduled[0].fn();
  assert(calls === 1);
  d.flush();
  assert(calls === 1, 'flush() should not re-run fn once the scheduled callback already ran it');
});

run();

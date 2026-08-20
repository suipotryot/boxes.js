// A tiny debounce with an injectable scheduler — testHarness.js's run() is
// fully synchronous (no async/await support at all), so tests need to
// drive time deterministically rather than actually waiting on real
// timers. Implemented via a generation counter rather than clearTimeout:
// a scheduled callback only actually invokes `fn` if no newer call() has
// superseded it since it was scheduled. This means the injected
// `scheduler` only ever needs to be a bare `(fn, ms) => void`, exactly
// like real setTimeout — a fake scheduler in a test doesn't need to
// implement cancellation at all, it can just record every scheduled
// callback and fire them in any order.

export function debounce(fn, ms, scheduler = setTimeout) {
  let generation = 0;
  let pendingArgs = null;

  return {
    call(...args) {
      generation++;
      pendingArgs = args;
      const thisGeneration = generation;
      scheduler(() => {
        if (thisGeneration !== generation) return; // superseded by a later call()
        const toRun = pendingArgs;
        pendingArgs = null;
        fn(...toRun);
      }, ms);
    },
    /** Runs any pending call immediately, without waiting for the
     *  scheduler — used on 'beforeunload' so a change made just before
     *  closing the tab isn't lost to an autosave that hadn't fired yet. */
    flush() {
      if (pendingArgs === null) return;
      generation++; // invalidate any still-pending scheduled callback
      const toRun = pendingArgs;
      pendingArgs = null;
      fn(...toRun);
    },
  };
}

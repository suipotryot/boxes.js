import { test, assert, run } from './testHarness.js';

class FakeImage {
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.onload());
  }
}

globalThis.Image = FakeImage;
globalThis.document = {
  createElement: () => ({ getContext: () => ({ drawImage() {} }) }),
};

const { loadEngravedImageTexture, disposeEngravedImageTextures } = await import('../ui/EngravedImageTexture.js');

const image = { svg: '<svg/>', widthMm: 10, heightMm: 5 };

test('disposeEngravedImageTextures: should not dispose a texture loaded again while it was waiting for the pending ones', async () => {
  const texture = await loadEngravedImageTexture(image);
  let disposeCount = 0;
  texture.addEventListener('dispose', () => { disposeCount += 1; });
  const disposing = disposeEngravedImageTextures();
  const reloaded = await loadEngravedImageTexture(image);
  await disposing;
  assert(disposeCount === 1 && reloaded !== texture, 'expected the old texture to be disposed once and replaced');
  const afterDispose = await loadEngravedImageTexture(image);
  assert(afterDispose === reloaded, 'expected the reloaded texture to stay in the cache');
});

run();

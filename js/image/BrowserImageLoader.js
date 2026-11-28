import { requestEngravingImage } from './EngravingImageRequest.js';
import { browserEngravingEnvironment } from './BrowserEngravingEnvironment.js';
import { assertWellFormedSvg } from './assertWellFormedSvg.js';

function wellFormedImageOf(loadedImage) {
  assertWellFormedSvg(loadedImage.svg);
  return loadedImage;
}

export function loadImageInBrowser(url) {
  return new Promise((resolve, reject) => {
    requestEngravingImage(url, browserEngravingEnvironment, {
      onImage: (loadedImage) => {
        try {
          resolve(wellFormedImageOf(loadedImage));
        } catch (error) {
          reject(error);
        }
      },
      onError: reject,
    });
  });
}

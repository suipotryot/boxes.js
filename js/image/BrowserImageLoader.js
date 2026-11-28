import { requestEngravingImage } from './EngravingImageRequest.js';
import { browserEngravingEnvironment } from './BrowserEngravingEnvironment.js';
import { assertWellFormedSvg } from './assertWellFormedSvg.js';

function assertWellFormedAnswer(answer) {
  assertWellFormedSvg(answer.svg);
  return answer;
}

export function loadImageInBrowser(url) {
  return new Promise((resolve, reject) => {
    requestEngravingImage(url, browserEngravingEnvironment, {
      onImage: (answer) => {
        try {
          resolve(assertWellFormedAnswer(answer));
        } catch (error) {
          reject(error);
        }
      },
      onError: reject,
    });
  });
}

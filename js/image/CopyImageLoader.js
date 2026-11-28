async function loadImageNamingItsPlace(loadImage, url, copyIndex, imageIndex) {
  try {
    return await loadImage(url);
  } catch (error) {
    throw new Error(`Copy ${copyIndex + 1}, image ${imageIndex + 1} (${url.href}): ${error.message}`, { cause: error });
  }
}

async function loadImagesOfCopy(loadImage, urls, copyIndex) {
  const answers = [];
  for (const [imageIndex, url] of urls.entries()) {
    answers.push(await loadImageNamingItsPlace(loadImage, url, copyIndex, imageIndex));
  }
  return answers;
}

export async function loadCopyImages(urlsByCopy, loadImage) {
  const answersByCopy = [];
  for (const [copyIndex, urls] of urlsByCopy.entries()) {
    answersByCopy.push(await loadImagesOfCopy(loadImage, urls, copyIndex));
  }
  return answersByCopy;
}

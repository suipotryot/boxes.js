import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Bundles the whole app (JS + CSS) into one self-contained dist/index.html
// so it can be dropped straight onto a static blog with no separate assets.
export default defineConfig({
  plugins: [viteSingleFile()],
});

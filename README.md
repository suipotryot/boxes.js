# boxes.js

A graphical tool to design laser-cut boxes with detailed internal dividers, in the spirit of [boxes.py](https://github.com/florianfesti/boxes)'s TrayLayout, but with a true recursive guillotine split model instead of a uniform grid: each zone subdivides independently of its siblings, dividers get finger joints (including T-junctions and half-lap X-crossings between dividers of different heights), and everything exports as nested, burn-corrected SVG cutting files.

Runs entirely client-side, offline, as a single `dist/index.html` you open by double-clicking — no install, no server, no internet connection required. Works in Firefox and Chrome.

## Features

- Recursive zone splitting with live 2D preview (Konva), colored by divider height so same-height walls/dividers are visually obvious at a glance
- Automatic finger-joint generation: bottom edge to base plate, wall corners, T-junctions, and X-crossing half-lap notches
- An intermediate shelf/lid, fixed (finger-jointed into the outer walls) or removable (rests on cleats)
- Grip notches on dividers (rectangular or rounded, adjustable size)
- Live 3D preview (Three.js), draggable/resizable floating panel
- Undo/redo, IndexedDB autosave with a recent-projects list, JSON export/import
- SVG export: burn compensation, selectable inner-corner relief style, panels grouped by material thickness and nested onto laser-bed-sized pages with a MaxRects packer, downloaded sequentially

## Development

```
npm install
npm run dev      # dev server with hot reload
npm run test     # Vitest
npm run build    # produces dist/index.html -- verify by opening it directly (file://), not via `npm run preview`
```

## License

Free software licensed under the GNU General Public License v3.0 or later (GPLv3+) — see [LICENSE](LICENSE). This choice follows the license of [boxes.py](https://github.com/florianfesti/boxes) by Florian Festi, out of respect for the original author, even though boxes.js's algorithms are reimplemented independently rather than ported from its code.

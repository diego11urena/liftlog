# Third-party assets

## Body figure (muscle diagram): `src/data/body.json`

- **Source:** MuscleMap by Jsplice / MuscleMap contributors, npm package `@musclemap/assets` 1.1.0
  (https://github.com/Jsplice/MuscleMap). Male front and back diagrams only.
- **License:** MIT. The project's ASSET_PROVENANCE.md states the muscle path data is original vector work
  hand-traced in Inkscape for that project and is MIT like the code. Full license text below.
- **What we changed:** `scripts/build-body.ts` splits each muscle path into its sub-shapes and assigns each
  sub-shape to one of our 39 canonical regions (src/muscles.ts). The single chest shape is split into upper and
  lower with a clip line at 45% of its height. Separation lines and the fiber hatching are drawn by our own
  `src/MuscleMap.tsx`; colors come from the theme tokens.
- **Gaps:** `neck` has no shape of its own and lights up the upper traps. `brachialis` only exists as a small
  shape on one arm in the front view.
- Not taken from the Arrow app in any way.

```
MIT License

Copyright (c) 2026 Jsplice / MuscleMap contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Exercise instructions and photos

- **Source:** free-exercise-db (https://github.com/yuhonas/free-exercise-db). **License:** The Unlicense
  (public domain). Used only for instructions/photos of curated exercises that match a dataset entry.

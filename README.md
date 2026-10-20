# Liftlog

Personal, offline-first workout log PWA. React + TypeScript + Vite, Dexie (IndexedDB), Tailwind, Recharts.
All data stays on this device's browser storage (there is no export/backup by design).

## Run

`npm run serve` builds and starts the server (app + sync) on :4173. Every device that opens it syncs its data through the Mac (`server/data/liftlog.sqlite`, git-ignored; back up that file).

```sh
npm install
npm run dev          # http://localhost:5173 (also on your LAN, but see HTTPS below)
npm test             # unit tests: e1RM, PR detection, logged-set rule, volume totals
npm run build        # production build to dist/
npm run preview      # serve dist/ on :4173
```

Data scripts (outputs are committed; run only when the source changes):

- `npm run check:exercises`: validates `scripts/curated-exercises.json` (aliases, classification, muscles, required exercises).
- `npm run build:exercises`: curated list + instructions/photos from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain) → `src/data/exercises.seed.json`. Bump `SEED_VERSION` in `src/db.ts` after changing it.
- `npm run build:body`: MuscleMap (MIT) figure → `src/data/body.json`. Open `/dev/muscles` to check every region. Sources and licenses: `docs/ASSETS.md`.

## Hosting

Production is a free static deploy on Vercel: **https://liftlog-livid.vercel.app** (`npx vercel deploy --prod`).
Open it in Safari on the iPhone → Share → **Add to Home Screen**. It works offline; data is stored on the phone.

Moving data to a new address: `node --experimental-strip-types scripts/export-link.ts <new-url>` prints a one-time
`#import=` link built from the Mac sync server's copy (`server/data/liftlog.sqlite`). Open it on the phone once.

Optional local sync server (not used in production): `npm run serve`, or `npm run install-service` to run it at login.

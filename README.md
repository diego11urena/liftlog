# Liftlog

Personal, offline-first workout log PWA. React + TypeScript + Vite, Dexie (IndexedDB), Tailwind, Recharts.
All data stays on this device's browser storage (there is no export/backup by design).

## Run

```sh
npm install
npm run dev          # http://localhost:5173 (also on your LAN, but see HTTPS below)
npm test             # unit tests: e1RM, PR detection, logged-set rule, volume totals
npm run build        # production build to dist/
npm run preview      # serve dist/ on :4173
```

`npm run build:exercises` re-downloads [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(Unlicense, public domain) and regenerates `src/data/exercises.seed.json`. If you change it, bump
`SEED_VERSION` in `src/db.ts`. Unmapped muscle names fail the script on purpose. Fix the mapping instead of dropping exercises.

## Hosting on your phone (needs HTTPS)

Service workers and "Add to Home Screen" only work over HTTPS (or localhost). `http://192.168.x.x` won't install.

### Option A: Tailscale (recommended, also works away from home)

1. Install Tailscale on the computer and the phone, and sign in to both with the same account.
2. In the Tailscale admin console, enable **MagicDNS** and **HTTPS certificates**.
3. On the computer:
   ```sh
   npm run build
   npm run preview &                 # serves on :4173
   tailscale serve --bg 4173         # https://<machine>.<tailnet>.ts.net
   ```
4. Open that URL on the phone. On iOS use Safari → Share → Add to Home Screen. On Android use Chrome → Install app.

`tailscale serve status` shows the URL. `tailscale serve reset` stops it.

### Option B: mkcert (LAN only)

```sh
brew install mkcert && mkcert -install
mkcert -cert-file cert.pem -key-file key.pem 192.168.1.50 localhost   # your computer's LAN IP; *.pem is git-ignored
npm run build && npm run preview    # picks up cert.pem/key.pem automatically → https://192.168.1.50:4173
```

The phone must trust the mkcert root CA. Get its location from `mkcert -CAROOT`, AirDrop `rootCA.pem` to the phone,
install the profile, then go to Settings → General → About → Certificate Trust Settings and enable it.

After the first load the app works fully offline, including in airplane mode. Exercise photos are cached the first time you view them.

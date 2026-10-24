# Creeked-up

A real-life fishing game. Go fishing, log your catches, earn EXP and level up.

This first version is a **mobile web app**. It runs in the browser on iPhone and Android, works with no signal, and costs nothing to host on GitHub Pages.

## What it does now

- **Log a catch:** photo from the camera, species, length, weight, time, GPS, bait or lure, kept or released, and notes.
- **EXP per fish:** based on species, size, first-of-species bonus, a release bonus, and proof (photo and GPS).
- **Levels:** each level unlocks a new title.
- **Badges** and a **species collection** with your personal best for each fish.
- **Stats:** catches, species, total EXP, release rate and biggest fish.
- **Backup:** export and import your catches as a file.

Everything is saved only on your phone. Nothing is uploaded.

## How EXP works

```
EXP = species base × size bonus × first-of-species (×2) × released (×1.1) × proof
```

- **Size bonus:** your fish's length compared to a typical length for its species. Smaller fish count for less, but never under ×0.5. Bigger fish count for more, up to ×4.
- **Proof:** photo and GPS = ×1, one of them = ×0.75, neither = ×0.5.

The typical lengths and base EXP are set in `js/data.js`. **The typical lengths are rough placeholders** and still need checking against a credible source.

## Put it online (free, one time)

1. On GitHub, open this repo and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then pick **main** and **/ (root)**, then **Save**.
3. After a minute or two, the page shows your link. It looks like `https://mindchips1234.github.io/Creeked-up/`.
4. Open that link on your phone.
   - **iPhone (Safari):** tap Share, then **Add to Home Screen**.
   - **Android (Chrome):** tap the ⋮ menu, then **Add to Home screen** or **Install app**.

## Limits to know about

- Data lives in the phone's browser. If you clear your browser data or switch phones, it's gone unless you exported a backup.
- The camera button opens your camera on most phones. Some phones also let you pick a gallery photo, so this doesn't stop old photos from being used yet.
- There's no fish scan, map, accounts, or leaderboards yet. Those are the next phases.
- Always check the [Ontario Fishing Regulations Summary](https://www.ontario.ca/document/ontario-fishing-regulations-summary) before keeping a fish.

## For developers

No build step. The app is plain HTML, CSS and JavaScript.

- Run it locally: `python3 -m http.server` and open http://localhost:8000
- Run the tests: `node --test tests/*.test.js`
- When you change any app file, bump `CACHE` in `sw.js` so phones get the update.

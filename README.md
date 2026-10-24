# Creeked-up

A real-life fishing game. Go fishing, log your catches, earn EXP and level up.

This first version is a **mobile web app**. It runs in the browser on iPhone and Android, works with no signal, and costs nothing to host on GitHub Pages.

## What it does now

- **Intro:** "Vanderholst Studios presents" plays at launch. Tap to skip, or replay it from Profile.
- **Home:** your level, quick buttons, your latest catch, your next badge goal, and a link to the fishing regulations.
- **Map (Find spots):** pick a fish and a distance. It ranks nearby lakes and rivers by how recently and how many of that fish Ontario stocked there, using the province's public [fish stocking records](https://data.ontario.ca/dataset/fish-stocking). It also shows a starting tackle tip, directions, and your own catches as orange dots. Results are saved for a week so they work offline.
- **Weekly quests:** 3 new quests every Monday, worth bonus EXP when you finish them.
- **Conditions:** moon phase (worked out on the phone) and current weather, wind, pressure, sunrise and sunset from [Open-Meteo](https://open-meteo.com/) (free for non-commercial use, CC BY 4.0).
- **Fish scan:** tap what you see on the fish (spots, whiskers, a white tail tip and so on) and it ranks the likely species, with the key mark to check for each one.
- **Tackle box:** save your lures and baits. They show up when you log a catch, and the map shows your best bait for each fish.
- **Share:** turn any catch into a picture card and share it.
- **Log a catch:** photo from the camera, species, length, weight, time, GPS, how you caught it, bait or lure, kept or released, and notes.
- **Ways to fish:** pick how you caught each fish: float, lure, jigging, bottom, fly fishing, trolling, ice fishing or other. The app remembers your last pick. Tap "What are these?" for a beginner guide to each method, with its gear, rules and the fish it's good for. Tackle box items can be tagged with a method, the Catches tab can filter by method, Profile shows your top method, and the map tip changes for the method you pick.
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
- The map only covers the 12 species Ontario stocks (trout, salmon, walleye, splake, whitefish, bluegill). Bass, pike, perch and muskie aren't stocked, so they can't be suggested yet.
- Stocked means fish were put there, not that they're biting or that the shore is public.
- The tackle tips are general starting points, not expert or official advice.
- The method guide is summarized from Ontario's [Learn to fish](https://www.ontario.ca/page/learn-fish-online) course, Ontario's [Rules on using fishing tackle](https://www.ontario.ca/page/rules-using-fishing-tackle) and the Canadian Red Cross ice safety tips. "Good for" only lists fish the Ontario guide names for that method or its bait; a fish missing from the list may still bite. The Ontario guide doesn't cover ice fishing tactics, so ice fishing has no "good for" list yet.
- Fish scan is a visual guide, not photo AI. There's no free, reliable fish-photo AI to use: iNaturalist's photo-ID service isn't public. Double-check IDs before keeping a fish.
- Open-Meteo's free plan is for non-commercial use only. If the app ever has ads or subscriptions, weather needs a paid plan.
- There are no accounts or leaderboards yet.
- Always check the [Ontario Fishing Regulations Summary](https://www.ontario.ca/document/ontario-fishing-regulations-summary) before keeping a fish.

## For developers

No build step. The app is plain HTML, CSS and JavaScript.

- Run it locally: `python3 -m http.server` and open http://localhost:8000
- Run the tests: `node --test tests/*.test.js`
- When you change any app file, bump `CACHE` in `sw.js` so phones get the update.

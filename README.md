# Creeked-up

A real-life fishing game. Go fishing, log your catches, earn EXP and level up.

This first version is a **mobile web app**. It runs in the browser on iPhone and Android, works with no signal, and costs nothing to host on GitHub Pages.

## What it does now

- **Intro:** "Vanderholst Studios presents" plays at launch. Tap to skip, or replay it from Profile.
- **Home:** your level, quick buttons, your latest catch, your next badge goal, and a link to the fishing regulations.
- **Map (Find spots):** pick any of the game's fish and a distance. It finds lakes, rivers and streams near you where Ontario's fish surveys have recorded that fish (the same [Aquatic Resource Area](https://data.ontario.ca/dataset/aquatic-resource-area-polygon-segment) data behind the province's Fish ON-Line map), draws their outlines, and marks boat launches, docks, piers and shore access from Ontario's [Fishing Access Points](https://data.ontario.ca/dataset/fishing-access-points) and [OpenStreetMap](https://www.openstreetmap.org/copyright). Waters with a known way in, recent [stocking](https://data.ontario.ca/dataset/fish-stocking) and a short drive rank higher. Directions go to the exact access point. It also shows a starting tackle tip and your own catches as orange dots. Results are saved for a week so they work offline.
- **Daily challenges and weekly quests:** 2 new challenges every day and 3 new quests every Monday, worth bonus EXP when you finish them. A "catch this fish" challenge only picks fish that are in season in Ontario's Fisheries Management Zone 17, using the zone-wide dates from the province's [Zone 17 rules](https://www.ontario.ca/page/sport-fishing-variation-order-fisheries-management-zone-17). A fish caught while its season is closed doesn't count toward challenges, and the app tells you to release it.
- **Conditions:** moon phase (worked out on the phone) and current weather, wind, pressure, sunrise and sunset from [Open-Meteo](https://open-meteo.com/) (free for non-commercial use, CC BY 4.0).
- **Fish scan:** tap what you see on the fish (spots, whiskers, a white tail tip and so on) and it ranks the likely species, with the key mark to check for each one.
- **Tackle box:** save your lures and baits. They show up when you log a catch, and the map shows your best bait for each fish.
- **Share:** turn any catch into a picture card and share it.
- **Log a catch:** photo from the camera or the phone's gallery, species, length, weight, time, GPS, how you caught it, bait or lure, kept or released, and notes.
- **Ways to fish:** pick how you caught each fish: float, lure, jigging, bottom, fly fishing, trolling, ice fishing or other. The app remembers your last pick. Tap "What are these?" for a beginner guide to each method, with its gear, rules and the fish it's good for. Tackle box items can be tagged with a method, the Catches tab can filter by method, Profile shows your top method, and the map tip changes for the method you pick.
- **EXP per fish:** based on species, size, first-of-species bonus, a release bonus, and proof (photo and GPS).
- **Levels:** each level unlocks a new title.
- **Badges** and a **species collection** with your personal best for each fish.
- **Stats:** catches, species, total EXP, release rate and biggest fish.
- **Backup:** export and import your catches as a file.
- **Accounts (optional):** sign up with a username, email and password to keep your catches, photos, badges, stats and tackle box on every phone you log in on. Catches made before you sign up are added to the account. It still works with no signal: catches save on the phone first and upload when you're back online. Sign out, and delete your account (with its photos) from Profile.
- **Friends:** add friends by username or 8-letter friend code. They have to accept. Then you can see each other's level, stats, badges and catches (fish, size, weight, date, method, bait, kept or released, and photo). Unfriend or block anyone at any time.

Without an account, everything is saved only on your phone and nothing is uploaded.

## Privacy and safety

- **Friends never see where you caught a fish, or your notes.** The database itself only hands friends a fixed list of safe fields (see `friend_catches` in [supabase/setup.sql](supabase/setup.sql)), so this doesn't depend on the app behaving. Photos uploaded to your account are re-saved by the app, which removes the GPS data hidden inside photo files. A photo can still show where you were, so watch the background.
- **No public profiles or user search.** You can only find someone by their exact username or friend code, and only friends see anything.
- **You must be 13 or older to make an account.** Sign-up asks for birth month and year (not saved) and turns away anyone younger on that phone. This follows Canada's privacy commissioner, whose [consent guidelines](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/) say that, in all but exceptional cases, anyone under 13 needs a parent or guardian's consent. The app can't verify ages, so someone can lie. Under 13s can still use everything else with no account.
- **Blocking** removes the friendship and stops that person from finding you or sending requests.
- **No chat or messages**, so strangers can't contact anyone through the app.
- Your account data is stored by Supabase. Setup is in [docs/accounts-setup.md](docs/accounts-setup.md).

## How EXP works

```
EXP = species base × size bonus × first-of-species (×2) × released (×1.1) × proof
```

- **Size bonus:** your fish's length compared to a typical length for its species. Smaller fish count for less, but never under ×0.5. Bigger fish count for more, up to ×4.
- **Proof:** photo and GPS = ×1, one of them = ×0.75, neither = ×0.5.
- **Gallery photos:** the app reads the date and place saved inside the photo and fills them in. The photo only counts as proof if its date is within 2 days of the catch time, and the same photo can't be logged twice. Screenshots and photos sent through chat apps usually have no date, so they don't count.

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
- The map says where surveys have recorded a fish, not how many there are or whether they're biting. Some records are old.
- Ontario's access point data was last checked in 2015, and OpenStreetMap is mapped by volunteers. Both can miss spots or be out of date, so always check that a shore is public. Private marinas are labelled as private.
- Species at risk are left out of Ontario's public survey data on purpose.
- To search, the app sends a rough area (rounded to about 1 km) to Ontario's map servers and the free Overpass API for OpenStreetMap. Your catches are never sent to them. The public Overpass server asks apps to keep use light; if the app grows a lot, it will need its own server or a paid one.
- The live map servers haven't been tested from a phone yet. If Ontario's server blocks browser requests, the app falls back to a second method (JSONP) automatically.
- The tackle tips are general starting points, not expert or official advice.
- The method guide is summarized from Ontario's [Learn to fish](https://www.ontario.ca/page/learn-fish-online) course, Ontario's [Rules on using fishing tackle](https://www.ontario.ca/page/rules-using-fishing-tackle) and the Canadian Red Cross ice safety tips. "Good for" only lists fish the Ontario guide names for that method or its bait; a fish missing from the list may still bite. The Ontario guide doesn't cover ice fishing tactics, so ice fishing has no "good for" list yet.
- Fish scan is a visual guide, not photo AI. There's no free, reliable fish-photo AI to use: iNaturalist's photo-ID service isn't public. Double-check IDs before keeping a fish.
- Open-Meteo's free plan is for non-commercial use only. If the app ever has ads or subscriptions, weather needs a paid plan.
- Only fish found in Zone 17 can be logged, scanned or picked for challenges, based on the province's [FMZ 17 fisheries management plan background (2008)](https://www.ontario.ca/files/2025-06/264336.pdf) and [plan (2009)](https://www.ontario.ca/files/2025-06/264321.pdf). Those are older documents. Lake trout, splake, aurora trout and freshwater drum were removed (see `js/data.js` for why); old catches of them still show.
- Seasons are Zone 17's zone-wide dates only (in `js/seasons.js`). Some lakes, rivers and fish sanctuaries in the zone have their own dates, and the app can't tell which lake you're on. In season also doesn't mean that fish lives near you.
- Accounts only work once the free Supabase project is set up (see [docs/accounts-setup.md](docs/accounts-setup.md)). Until then, Profile and Friends say "coming soon".
- Supabase's free plan pauses the project after a week with no use. Syncing stops until it's restored from the Supabase dashboard; the app keeps working offline. Photo storage is 1 GB in total for everyone.
- "Forgot your password?" won't send emails until an email service is hooked up to Supabase (step 6 in the setup guide).
- If two phones change the tackle box while both are offline, the last one to sync wins. Catches don't have this problem.
- Friends' stats are worked out on each person's phone, so like catches, they're on the honour system.
- There are no leaderboards yet.
- Always check the [Ontario Fishing Regulations Summary](https://www.ontario.ca/document/ontario-fishing-regulations-summary) before keeping a fish.

## For developers

No build step. The app is plain HTML, CSS and JavaScript.

- Run it locally: `python3 -m http.server` and open http://localhost:8000
- Run the tests: `node --test tests/*.test.js` (the database tests in `tests/server.test.js` skip unless pointed at a test copy of Supabase; see [supabase/local/README.md](supabase/local/README.md))
- Accounts: `js/cloud.js` (sign in, sync, friends), `js/account.js` (the screens), `js/config.js` (Supabase URL and publishable key), `supabase/setup.sql` (tables and privacy rules). The Supabase library is in `vendor/supabase/` (supabase-js 2.117.3, MIT).
- When you change any app file, bump `CACHE` in `sw.js` so phones get the update.

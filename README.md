# Micenae

Training and nutrition for the classical physique. This is a local-first MVP: a mobile-first React + TypeScript web app, installable as a PWA.

## Features (MVP)

- **Profile:** weight, height, estimated body fat, age, sex, activity and focus. From these it derives lean mass, normalised FFMI, BMR (Katch–McArdle), maintenance energy (TDEE), daily macro targets, and the *path to the ideal* (the gap to a lean, natural FFMI target).
- **Diary:** food by meal (breakfast, lunch, dinner, snacks, pre/post-workout) with time, quantity and unit (grams or the food's USDA household measures). Also training, a calorie ring, macro bars, and a full vitamin/mineral breakdown with %DV.
- **Voice logging:** speak (or type) "for lunch I had 200 g of chicken breast, a cup of rice and two large eggs". The transcript is parsed into items, quantities, units, meal and time, then matched against the catalog. You review and adjust before anything is saved.
- **Food catalog:** 7,770 foods from **USDA FoodData Central** (Foundation Foods + SR Legacy, public domain). SR Legacy is the USDA reference dataset that most consumer apps, MyFitnessPal included, built their generic foods on. You can also create your own foods per serving or per 100 g, with optional micronutrients.
- **AI assistant (optional):** add a Claude or OpenAI API key in *Profile › Assistant*. Write or record what you ate or trained, and an agent searches your catalog with tools (`search_foods`, `log_food`, `create_food`, `search_exercises`, `log_training`) and logs it directly. Each item can be undone. Recorded or uploaded voice notes are transcribed by OpenAI or ElevenLabs Scribe (Claude's API doesn't take audio); live dictation uses the browser.
- **Objective and ranks:** set a target physique (default: normalised FFMI 22.5 at 11 % body fat for men, 18.5 at 19 % for women). Progress is the share of the needed lean-mass gain plus fat loss you've achieved, and it moves you through Villager → Hardman → Soldier → General → Champion → Semi-god → God.
- **Periodised programs (2–12 weeks):** Kickstart, Foundation (full body), Upper/Lower, Push/Pull/Legs and Lean Out (cut), plus sport and functional programs: Boxing, Football, Swimming dryland, Runner strength and Athletic. Every week is pre-designed. The weekly update, by rules or by the AI coach, only *chooses* which week runs next (progress, repeat, lighter, condensed, or skip a lighter week) from your adherence and strength trend.
- **Calories burned:** quick-log a walk, run, cycle, swim or hike. The estimate is pace-based (ACSM equations) when you add a distance, otherwise MET-based (Compendium), and is shown as a range. Extra activity adds its net calories to the day's budget.
- **Periodisation:** rep ranges rotate weekly, volume and effort build through each block, accessories change every 2 weeks and main lifts each block, with lighter weeks in longer programs. Sessions are dated on your chosen days and logged set by set.
- **Nutrition plan:** energy, protein, fat and carbohydrate targets matched to the phase (cut/recomp/build) and to training versus rest days.
- **Update plan:** reviews the last 15 days of training and 10 days of food and weigh-ins. It reschedules missed sessions for the rest of the week and adjusts calories only when the trend and adherence say so. Rule-based by default; with an AI key, a coach model decides within enforced limits. See [docs/EVIDENCE.md](docs/EVIDENCE.md) for every rule and its source.
- **Training:** 70 exercises split into aerobic and weight training. Aerobic is logged with duration, distance and intensity; strength with sets × reps × kg, pre-filled from your last session. Energy is estimated with MET values from the Compendium of Physical Activities.
- **Trials:** placeholder for the upcoming baseline assessments.

## Accounts and sync (Firebase)

Firebase project: `micenae-ef391`. Sign-in is with Google (Firebase Auth). Data lives in Firestore under `users/{uid}/…`, and `firestore.rules` lets each user read and write only their own data. The app is offline-first: Firestore's local cache keeps working without signal and syncs when you're back online. "Continue without an account" keeps everything on the device, and it's uploaded the first time you sign in.

```bash
npm run emulators          # local Auth + Firestore emulators
npm run dev:emulators      # app pointed at the emulators
npm run test:rules         # security-rules tests (runs the emulator)
npx firebase login         # once, on your machine
npm run deploy             # build + deploy hosting and Firestore rules
npm run upload:foods -- --key path/to/service-account.json   # USDA catalog → Firestore foods/{id}
```

The food catalog also lives in Firestore (`foods/{id}` plus `catalog/usda` metadata), readable by signed-in users and writable only by the admin upload script. The app still searches its downloaded copy of the same data, because loading 7,770 documents on every app start would use up the free daily read quota in a few launches.

## Deploying (from your phone)

`.github/workflows/deploy.yml` builds, tests (unit + security rules) and deploys hosting and Firestore rules. Run it from GitHub: **Actions → Deploy to Firebase → Run workflow**. In the GitHub app or in your phone's browser, that's a few taps. Pushes to `main` deploy automatically.

One-time setup:
1. **Key:** Firebase console → Project settings → Service accounts → *Generate new private key* (or reuse the one from `upload:foods`).
2. **Secret:** GitHub → this repo → Settings → Secrets and variables → Actions → *New repository secret*. Name it `FIREBASE_SERVICE_ACCOUNT` and paste the whole JSON file as the value.
3. **Permissions:** Google Cloud console → IAM → the `firebase-adminsdk-…` service account → add the role **Firebase Admin**.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # parser, metrics, voice→catalog matching
npm run build
```

Rebuild the food catalog from USDA (downloads ~14 MB):

```bash
npm run import:usda
```

## Architecture

```
scripts/import-usda.mjs   USDA FDC → public/data/usda-foods.json (per 100 g, compact)
src/domain/               pure logic: nutrients, body metrics, portions, exercises
src/data/                 catalog loading, search engine, zustand store (localStorage)
src/agent/                LLM agent loop (Claude Messages API / OpenAI Chat Completions), tools, transcription
src/voice/                speech hook (Web Speech API), utterance parser, catalog matcher
src/ui/                   screens and components
```

- **Storage:** zustand persisted to `localStorage`. The state shape maps directly onto Firestore collections (`users/{uid}/foodEntries`, …) for the Firebase Auth version.
- **Transcription:** the browser's Web Speech API (Chrome/Edge/Safari) behind `useSpeech`. To support every browser and recorded audio uploads, swap in a server transcriber (e.g. Whisper behind a Firebase Function fed by `MediaRecorder`). The parser and matcher don't change.
- **Search:** token matching with stemming, synonyms, USDA naming heuristics, a small popularity prior, and a boost for recently used foods.

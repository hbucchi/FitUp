# Micenae

Training and nutrition for the classical physique. This is a local-first MVP: a mobile-first React + TypeScript web app, installable as a PWA.

## Features (MVP)

- **Profile:** weight, height, estimated body fat, age, sex, activity and focus. From these it derives lean mass, normalised FFMI, BMR (Katch–McArdle), maintenance energy (TDEE), daily macro targets, and the *path to the ideal* (the gap to a lean, natural FFMI target).
- **Diary:** food by meal (breakfast, lunch, dinner, snacks, pre/post-workout) with time, quantity and unit (grams or the food's USDA household measures). Also training, a calorie ring, macro bars, and a full vitamin/mineral breakdown with %DV.
- **Voice logging:** speak (or type) "for lunch I had 200 g of chicken breast, a cup of rice and two large eggs". The transcript is parsed into items, quantities, units, meal and time, then matched against the catalog. You review and adjust before anything is saved.
- **Food catalog:** 7,770 foods from **USDA FoodData Central** (Foundation Foods + SR Legacy, public domain). SR Legacy is the USDA reference dataset that most consumer apps, MyFitnessPal included, built their generic foods on. You can also create your own foods per serving or per 100 g, with optional micronutrients.
- **Training:** 70 exercises split into aerobic and weight training. Aerobic is logged with duration, distance and intensity; strength with sets × reps × kg, pre-filled from your last session. Energy is estimated with MET values from the Compendium of Physical Activities.
- **Trials:** placeholder for the upcoming baseline assessments.

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
src/voice/                speech hook (Web Speech API), utterance parser, catalog matcher
src/ui/                   screens and components
```

- **Storage:** zustand persisted to `localStorage`. The state shape maps directly onto Firestore collections (`users/{uid}/foodEntries`, …) for the Firebase Auth version.
- **Transcription:** the browser's Web Speech API (Chrome/Edge/Safari) behind `useSpeech`. To support every browser and recorded audio uploads, swap in a server transcriber (e.g. Whisper behind a Firebase Function fed by `MediaRecorder`). The parser and matcher don't change.
- **Search:** token matching with stemming, synonyms, USDA naming heuristics, a small popularity prior, and a boost for recently used foods.

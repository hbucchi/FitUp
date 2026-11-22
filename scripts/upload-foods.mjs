#!/usr/bin/env node
/**
 * Uploads the food catalogs the app ships with to Cloud Firestore, so both hold the same records:
 *
 *   public/data/usda-foods.json  → foods/usda:…   + catalog/usda   (USDA FoodData Central)
 *   public/data/taco-foods.json  → foods/taco:…   + catalog/taco   (TACO 4ª ed., Brazil)
 *
 *   foods/{id}        one document per food (id matches the app, e.g. "usda:171705", "taco:3")
 *   catalog/{name}    metadata: version, count, sources, upload time
 *
 * Runs with admin credentials, so it bypasses security rules (clients can only read).
 *
 * Usage:
 *   node scripts/upload-foods.mjs --key path/to/service-account.json [--dry-run] [--force]
 *   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/upload-foods.mjs
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/upload-foods.mjs   (local emulator)
 *
 * Re-running is skipped when the same catalog version is already uploaded (each run costs
 * one write per food — about 8,400 for both, within the free 20,000 writes/day). Use --force to redo.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'micenae-ef391';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);

/** Search keywords: lowercase, accents and punctuation removed, simple plural stemming. */
function keywords(name) {
  const words = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9%]+/)
    .filter((w) => w.length > 1);
  const out = new Set();
  for (const w of words) {
    out.add(w);
    if (w.length > 3 && w.endsWith('ies')) out.add(w.slice(0, -3) + 'y');
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) out.add(w.slice(0, -1));
  }
  return [...out];
}

const CATALOGS = [
  ['usda', 'public/data/usda-foods.json'],
  ['taco', 'public/data/taco-foods.json'],
].map(([name, file]) => ({ name, catalog: JSON.parse(readFileSync(resolve(root, file), 'utf8')) }));

function toDoc(f, version) {
  return {
    name: f.name,
    category: f.cat,
    source: f.src,
    fdcId: f.id.startsWith('usda:') ? Number(f.id.split(':')[1]) || null : null,
    nutrients: f.n, // per 100 g
    portions: f.p.map((p) => ({ label: p.l, grams: p.g })),
    ...(f.recipe ? { recipe: f.recipe } : {}),
    keywords: keywords(f.name),
    catalogVersion: version,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

if (flag('--dry-run')) {
  for (const { name, catalog } of CATALOGS) {
    console.log(`Would upload ${catalog.foods.length} ${name} foods (catalog ${catalog.generatedAt}). Example:`);
    console.log(JSON.stringify({ id: catalog.foods[0].id, ...toDoc(catalog.foods[0], catalog.generatedAt), updatedAt: '<server time>' }, null, 2));
  }
  process.exit(0);
}

const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const key = opt('--key');
initializeApp({
  projectId: PROJECT_ID,
  ...(emulator ? {} : { credential: key ? cert(JSON.parse(readFileSync(key, 'utf8'))) : applicationDefault() }),
});
const db = getFirestore();
let anyFailed = false;

for (const { name, catalog } of CATALOGS) {
  const version = catalog.generatedAt;
  const metaRef = db.doc(`catalog/${name}`);
  const meta = await metaRef.get();
  if (!flag('--force') && meta.exists && meta.get('version') === version && meta.get('count') === catalog.foods.length) {
    console.log(`${name}: catalog ${version} (${catalog.foods.length} foods) is already in Firestore. Use --force to upload again.`);
    continue;
  }
  console.log(`${name}: uploading ${catalog.foods.length} foods to ${emulator ? 'the emulator' : `project ${PROJECT_ID}`}…`);
  const writer = db.bulkWriter();
  let done = 0;
  let failed = 0;
  writer.onWriteResult(() => {
    if (++done % 1000 === 0) console.log(`  ${done} / ${catalog.foods.length}`);
  });
  writer.onWriteError((err) => {
    if (err.failedAttempts < 5) return true; // retry transient errors
    failed++;
    console.error(`  failed ${err.documentRef.id}: ${err.message}`);
    return false;
  });
  for (const f of catalog.foods) writer.set(db.collection('foods').doc(f.id), toDoc(f, version));
  await writer.close();
  if (failed) {
    console.error(`${name}: ${failed} foods failed — catalog metadata not updated. Run again to retry.`);
    anyFailed = true;
    continue;
  }
  await metaRef.set({
    version,
    count: catalog.foods.length,
    sources: catalog.sources,
    license: catalog.license,
    basis: 'per 100 g',
    uploadedAt: FieldValue.serverTimestamp(),
  });
  console.log(`${name}: done, ${done} foods uploaded (catalog ${version}).`);
}
process.exit(anyFailed ? 1 : 0);

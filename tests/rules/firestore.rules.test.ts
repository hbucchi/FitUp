import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, test } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-micenae-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
beforeEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

test('a user can read and write their own diary', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(alice, 'users/alice'), { profile: { name: 'A' } }));
  await assertSucceeds(setDoc(doc(alice, 'users/alice/foodEntries/e1'), { foodName: 'Egg' }));
  await assertSucceeds(setDoc(doc(alice, 'users/alice/plannedSessions/s1'), { title: 'Upper A' }));
  await assertSucceeds(setDoc(doc(alice, 'users/alice/checkIns/2026-11-22'), { sleepHours: 7.5, mood: 4 }));
  await assertSucceeds(getDoc(doc(alice, 'users/alice/foodEntries/e1')));
  await assertSucceeds(deleteDoc(doc(alice, 'users/alice/foodEntries/e1')));
});

test("nobody can touch someone else's data", async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice/foodEntries/e1'), { foodName: 'Egg' }));
  const bob = env.authenticatedContext('bob').firestore();
  await assertFails(getDoc(doc(bob, 'users/alice/foodEntries/e1')));
  await assertFails(setDoc(doc(bob, 'users/alice/foodEntries/e2'), { foodName: 'x' }));
  await assertFails(getDoc(doc(bob, 'users/alice')));
});

test('signed-out visitors get nothing', async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'users/alice')));
  await assertFails(setDoc(doc(anon, 'users/alice/foodEntries/e1'), { x: 1 }));
});

test('unknown collections and top-level paths are closed', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  await assertFails(setDoc(doc(alice, 'users/alice/secrets/k'), { x: 1 }));
  await assertFails(setDoc(doc(alice, 'other/x'), { x: 1 }));
});

test('food catalog: signed-in users read, nobody writes from the app', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'foods/usda:1'), { name: 'Egg' }));
  const alice = env.authenticatedContext('alice').firestore();
  await assertSucceeds(getDoc(doc(alice, 'foods/usda:1')));
  await assertFails(setDoc(doc(alice, 'foods/usda:1'), { name: 'Hacked' }));
  await assertFails(setDoc(doc(alice, 'catalog/usda'), { count: 0 }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'foods/usda:1')));
});

import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,

  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import { useStore, type AppState } from '../data/store';

/**
 * Two-way sync between the local zustand store and Firestore.
 *
 *   users/{uid}                       { profile, recentFoodIds, updatedAt }
 *   users/{uid}/foodEntries/{id}
 *   users/{uid}/trainingEntries/{id}
 *   users/{uid}/customFoods/{id}
 *   users/{uid}/customExercises/{id}
 *   users/{uid}/bodyLog/{YYYY-MM-DD}
 *
 * Local → remote: every store change is diffed per collection (by id and object identity)
 * and written as a batch. Remote → local: snapshot listeners replace the arrays.
 * Firestore's persistent cache makes both directions work offline.
 */

export const COLLECTIONS = ['foodEntries', 'trainingEntries', 'customFoods', 'customExercises', 'bodyLog', 'plannedSessions', 'checkIns', 'symptoms', 'bowelMovements'] as const;
/** Small per-user documents stored as fields of users/{uid}. */
export const USER_FIELDS = ['profile', 'recentFoodIds', 'objective', 'activePlan', 'nutritionPlan', 'reviews', 'rankSeen'] as const;
type CollectionKey = (typeof COLLECTIONS)[number];
type Item = { id?: string; date?: string };

const idOf = (key: CollectionKey, item: Item) => (key === 'bodyLog' || key === 'checkIns' ? item.date! : item.id!);

export type SyncStatus = { state: 'connecting' | 'ready' | 'error'; message?: string };

/** Pure diff — exported for tests. */
export function diffCollection<T extends Item>(key: CollectionKey, prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [idOf(key, x), x]));
  const after = new Map(next.map((x) => [idOf(key, x), x]));
  const upserts: T[] = [];
  const deletes: string[] = [];
  for (const [id, item] of after) if (before.get(id) !== item) upserts.push(item);
  for (const id of before.keys()) if (!after.has(id)) deletes.push(id);
  return { upserts, deletes };
}

/** Keep the local ordering stable when remote snapshots arrive (Firestore returns id order). */
function mergeOrder<T extends Item>(key: CollectionKey, local: T[], remote: T[]): T[] {
  const pos = new Map(local.map((x, i) => [idOf(key, x), i]));
  return [...remote].sort((a, b) => (pos.get(idOf(key, a)) ?? -1) - (pos.get(idOf(key, b)) ?? -1));
}

const strip = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T; // drop undefined, plain object

async function commitInChunks(db: Firestore, ops: ((b: ReturnType<typeof writeBatch>) => void)[]) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach((op) => op(batch));
    await batch.commit();
  }
}

function writeChanges(userRef: DocumentReference, prev: Partial<AppState>, next: AppState) {
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  for (const key of COLLECTIONS) {
    const p = (prev[key] ?? []) as Item[];
    const n = next[key] as Item[];
    if (p === n) continue;
    const { upserts, deletes } = diffCollection(key, p, n);
    for (const item of upserts) ops.push((b) => b.set(doc(userRef, key, idOf(key, item)), strip(item)));
    for (const id of deletes) ops.push((b) => b.delete(doc(userRef, key, id)));
  }
  if (USER_FIELDS.some((f) => prev[f] !== next[f])) {
    const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const f of USER_FIELDS) {
      const v = next[f];
      data[f] = v === undefined ? deleteField() : strip(v as object);
    }
    ops.push((b) => b.set(userRef, data, { merge: true }));
  }
  return ops;
}

let active: (() => void) | null = null;

/** Stop syncing right now (before sign-out, so clearing the device can't delete account data). */
export function stopSync() {
  active?.();
  active = null;
}

export function startSync(db: Firestore, uid: string, onStatus: (s: SyncStatus) => void): () => void {
  stopSync();
  const userRef = doc(db, 'users', uid);
  const unsubs: (() => void)[] = [];
  let applyingRemote = false;
  let stopped = false;
  const fail = (e: unknown) => onStatus({ state: 'error', message: (e as Error).message });

  const applyRemote = (patch: Partial<AppState>) => {
    applyingRemote = true;
    try {
      useStore.setState(patch);
    } finally {
      applyingRemote = false;
    }
  };

  (async () => {
    onStatus({ state: 'connecting' });
    const local = useStore.getState();
    // Local data belonging to a different account must never leak into this one.
    if (local.ownerUid && local.ownerUid !== uid) local.resetAll();

    const snap = await getDoc(userRef);
    if (stopped) return;
    const current = useStore.getState();
    if (!snap.exists()) {
      // First sign-in for this account: adopt whatever was logged on this device.
      const ops = writeChanges(userRef, {}, current);
      ops.push((b) => b.set(userRef, { createdAt: new Date().toISOString() }, { merge: true }));
      await commitInChunks(db, ops);
    }
    useStore.setState({ ownerUid: uid });

    // remote → local
    let pending = COLLECTIONS.length + 1;
    const loaded = () => --pending === 0 && onStatus({ state: 'ready' });
    let userLoaded = false;
    unsubs.push(
      onSnapshot(
        userRef,
        (d) => {
          const data = d.data() ?? {};
          applyRemote({
            profile: data.profile,
            recentFoodIds: data.recentFoodIds ?? [],
            objective: data.objective,
            activePlan: data.activePlan,
            nutritionPlan: data.nutritionPlan,
            reviews: data.reviews ?? [],
          });
          if (!userLoaded) (userLoaded = true), loaded();
        },
        fail,
      ),
    );
    for (const key of COLLECTIONS) {
      let first = true;
      unsubs.push(
        onSnapshot(
          collection(userRef, key),
          (qs) => {
            const remote = qs.docs.map((d) => d.data()) as Item[];
            applyRemote({ [key]: mergeOrder(key, useStore.getState()[key] as Item[], remote) } as Partial<AppState>);
            if (first) (first = false), loaded();
          },
          fail,
        ),
      );
    }

    // local → remote
    unsubs.push(
      useStore.subscribe((next, prev) => {
        if (applyingRemote || stopped) return;
        const ops = writeChanges(userRef, prev, next);
        if (ops.length) commitInChunks(db, ops).catch(fail);
      }),
    );
  })().catch(fail);

  const stop = () => {
    stopped = true;
    unsubs.forEach((u) => u());
    unsubs.length = 0;
  };
  active = stop;
  return stop;
}

/** Sign-out flow: detach from the account first, then wipe only this device's copy. */
export async function signOutAndClear(signOut: () => Promise<void>) {
  stopSync();
  await signOut();
  useStore.getState().resetAll();
}



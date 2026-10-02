// Storage backend. Uses Firebase (Firestore + anonymous auth) when firebase-config.js is
// filled in; otherwise, or when the URL has ?demo, a localStorage "demo" backend shared by
// the tabs of one browser. Both expose the same small API, used by app.js.

import { firebaseConfig } from './firebase-config.js';

export const isDemo = !firebaseConfig?.apiKey || new URLSearchParams(location.search).has('demo');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const randomString = (chars, n) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), b => chars[b % chars.length]).join('');
export const newCode = () => randomString(CODE_CHARS, 6);

// Applies a patch whose keys may be dotted field paths ("answers.abc"), like Firestore's updateDoc.
export function applyPatch(obj, patch) {
  const out = structuredClone(obj);
  for (const [path, val] of Object.entries(patch)) {
    const keys = path.split('.');
    let o = out;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    o[keys.at(-1)] = val;
  }
  return out;
}

export function createStore() {
  return isDemo ? demoStore() : firebaseStore();
}

function demoStore() {
  const KEY = 'quizduel.demo';
  const empty = () => ({ players: {}, games: {} });
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || empty(); } catch { return empty(); }
  };
  const listeners = new Set();
  const emit = () => queueMicrotask(() => listeners.forEach(fn => fn()));
  const save = db => { localStorage.setItem(KEY, JSON.stringify(db)); emit(); };
  addEventListener('storage', e => { if (e.key === KEY) emit(); });
  const watch = fn => { listeners.add(fn); fn(); return () => listeners.delete(fn); };

  return {
    // Per tab, so two tabs can play each other.
    session: {
      get: () => sessionStorage.getItem('quizduel.player'),
      set: id => id ? sessionStorage.setItem('quizduel.player', id) : sessionStorage.removeItem('quizduel.player'),
    },
    async getPlayer(id) { return load().players[id] || null; },
    async findPlayerByCode(code) { return Object.values(load().players).find(p => p.code === code) || null; },
    async createPlayer(name) {
      const db = load();
      const p = { id: randomString(ID_CHARS, 20), name, code: newCode(), createdAt: Date.now() };
      db.players[p.id] = p;
      save(db);
      return p;
    },
    async updatePlayer(id, patch) {
      const db = load();
      db.players[id] = { ...db.players[id], ...patch };
      save(db);
    },
    watchPlayers(cb) { return watch(() => cb(load().players)); },
    createGame(game) {
      const db = load();
      const id = randomString(ID_CHARS, 20);
      db.games[id] = { ...game, id };
      save(db);
      return id;
    },
    async updateGame(id, patch) {
      const db = load();
      db.games[id] = applyPatch(db.games[id], patch);
      save(db);
    },
    watchGames(pid, cb) {
      return watch(() => cb(Object.fromEntries(
        Object.entries(load().games).filter(([, g]) => g.players.includes(pid)))));
    },
    async reset() { localStorage.removeItem(KEY); sessionStorage.clear(); },
  };
}

async function firebaseStore() {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await A.signInAnonymously(auth);

  // Local cache: the app opens instantly and moves made offline sync later.
  const db = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  const players = F.collection(db, 'players');
  const games = F.collection(db, 'games');
  const withId = d => ({ id: d.id, ...d.data() });
  const onError = err => console.error(err);

  return {
    session: {
      get: () => localStorage.getItem('quizduel.player'),
      set: id => id ? localStorage.setItem('quizduel.player', id) : localStorage.removeItem('quizduel.player'),
    },
    async getPlayer(id) {
      const d = await F.getDoc(F.doc(players, id));
      return d.exists() ? withId(d) : null;
    },
    async findPlayerByCode(code) {
      const snap = await F.getDocs(F.query(players, F.where('code', '==', code), F.limit(1)));
      return snap.empty ? null : withId(snap.docs[0]);
    },
    async createPlayer(name) {
      const ref = F.doc(players);
      const p = { name, code: newCode(), createdAt: Date.now() };
      await F.setDoc(ref, p);
      return { id: ref.id, ...p };
    },
    updatePlayer(id, patch) { return F.updateDoc(F.doc(players, id), patch); },
    watchPlayers(cb) {
      return F.onSnapshot(players, s => cb(Object.fromEntries(s.docs.map(d => [d.id, withId(d)]))), onError);
    },
    // Writes aren't awaited by callers: Firestore applies them locally right away and
    // syncs in the background, so the game keeps working on a flaky connection.
    createGame(game) {
      const ref = F.doc(games);
      F.setDoc(ref, game).catch(onError);
      return ref.id;
    },
    updateGame(id, patch) { return F.updateDoc(F.doc(games, id), patch); },
    watchGames(pid, cb) {
      return F.onSnapshot(F.query(games, F.where('players', 'array-contains', pid)),
        s => cb(Object.fromEntries(s.docs.map(d => [d.id, withId(d)]))), onError);
    },
  };
}

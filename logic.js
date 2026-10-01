// Game rules. Pure functions over a game document, shared by every screen.
//
// A game looks like:
//   { players: [a, b], names: {a, b}, status: 'active' | 'finished', turn: playerId | null,
//     rounds: [{ chooser, options: [catId x3], category: catId | null, q: [questionId x3] }],
//     answers: { [playerId]: [ ... ] },   // flat, 3 per round; 0 = correct, 1-3 = wrong pick, -1 = ran out of time
//     winner, resignedBy, createdAt, updatedAt }
//
// Turn order (same as the original): the challenger picks round 1 and plays it. Then the
// other player plays that round, picks round 2 and plays it, and so on. Each player picks
// three of the six categories.

import { CATEGORIES, QUESTIONS } from './questions.js';

export const ROUNDS = 6;
export const PER_ROUND = 3;
export const TIME_LIMIT = 20; // seconds per question

export const catById = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getQuestion(id) {
  const [cat, i] = String(id).split('-');
  const q = QUESTIONS[cat]?.[+i];
  if (!q) return { id, cat, text: '(This question no longer exists)', answers: ['—', '—', '—', '—'], fact: '' };
  return { id, cat, text: q[0], answers: q.slice(1, 5), fact: q[5] || '' };
}

export const opponentOf = (g, me) => g.players.find(p => p !== me);
export const answersOf = (g, pid) => g.answers?.[pid] || [];
export const correctCount = arr => arr.filter(a => a === 0).length;

// Opponent results stay hidden for rounds you haven't played yet.
export function visibleOpponentAnswers(g, me) {
  const theirs = answersOf(g, opponentOf(g, me));
  if (g.status !== 'active') return theirs;
  const roundsDone = Math.floor(answersOf(g, me).length / PER_ROUND);
  return theirs.slice(0, roundsDone * PER_ROUND);
}

export function scores(g, me) {
  return [correctCount(answersOf(g, me)), correctCount(visibleOpponentAnswers(g, me))];
}

// 'pick' | 'play' | 'wait' | 'over'
export function nextStep(g, me) {
  if (g.status !== 'active') return 'over';
  if (g.turn !== me) return 'wait';
  const r = g.rounds[Math.floor(answersOf(g, me).length / PER_ROUND)];
  if (!r) return 'wait';
  return r.category ? 'play' : 'pick';
}

function pickOptions(g) {
  const used = new Set(g.rounds.map(r => r.category));
  const fresh = shuffle(CATEGORIES.filter(c => !used.has(c.id)));
  const rest = shuffle(CATEGORIES.filter(c => used.has(c.id)));
  return [...fresh, ...rest].slice(0, 3).map(c => c.id);
}

export function newRound(chooser, g) {
  return { chooser, options: pickOptions(g), category: null, q: [] };
}

// Picks 3 questions, avoiding ones already in this game and, when possible,
// ones either player has seen in earlier games (`seen`).
export function pickQuestions(cat, g, seen) {
  const inGame = new Set(g.rounds.flatMap(r => r.q || []));
  const ids = QUESTIONS[cat].map((_, i) => `${cat}-${i}`).filter(id => !inGame.has(id));
  const fresh = shuffle(ids.filter(id => !seen.has(id)));
  const old = shuffle(ids.filter(id => seen.has(id)));
  return [...fresh, ...old].slice(0, PER_ROUND);
}

export function newGame(me, opp, names) {
  const now = Date.now();
  const g = {
    players: [me, opp], names, status: 'active', turn: me,
    answers: { [me]: [], [opp]: [] }, rounds: [], createdAt: now, updatedAt: now,
  };
  g.rounds.push(newRound(me, g));
  return g;
}

function finishPatch(g) {
  const [a, b] = g.players;
  const sa = correctCount(answersOf(g, a)), sb = correctCount(answersOf(g, b));
  return { status: 'finished', turn: null, winner: sa === sb ? null : sa > sb ? a : b, finishedAt: Date.now() };
}

// What has to happen once `me` has completed a round: hand the turn over,
// open the next round (picked by `me`), or end the game. Returns null if nothing to do.
export function settlePatch(g, me) {
  const L = answersOf(g, me).length;
  if (g.status !== 'active' || g.turn !== me || L === 0 || L % PER_ROUND) return null;
  const opp = opponentOf(g, me);
  if (answersOf(g, opp).length < L) return { turn: opp };
  const done = L / PER_ROUND;
  if (done >= ROUNDS) return finishPatch(g);
  if (g.rounds.length > done) return null;
  return { rounds: [...g.rounds, newRound(me, g)] };
}

export function resignPatch(g, me) {
  return { status: 'finished', turn: null, winner: opponentOf(g, me), resignedBy: me, finishedAt: Date.now() };
}

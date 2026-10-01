import { createStore, isDemo, applyPatch } from './store.js';
import * as G from './logic.js';

const $app = document.getElementById('app');
const S = { store: null, me: null, players: {}, games: {}, view: { name: 'loading' } };
// The round being played: { id, ri, qi, q, order, choice, answered, deadline }
const P = {};
let timer = null;

// Screens that redraw when data changes on the server. Mid-question screens never do.
const LIVE = new Set(['home', 'game', 'new', 'profile', 'review']);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const initial = n => esc([...(n || '?').trim()][0]?.toUpperCase() || '?');
const nameOf = (g, pid) => S.players[pid]?.name || g?.names?.[pid] || 'Someone';
const byUpdated = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function go(name, params = {}) {
  S.view = { name, ...params };
  render();
  scrollTo(0, 0);
}

function render() {
  const v = S.view;
  $app.innerHTML = (VIEWS[v.name] || VIEWS.home)(v);
  document.body.dataset.view = v.name;
}

function refresh() {
  if (LIVE.has(S.view.name)) render();
  const n = Object.values(S.games).filter(g => g.status === 'active' && g.turn === S.me?.id).length;
  document.title = n ? `(${n}) Quiz Duel` : 'Quiz Duel';
  navigator.setAppBadge?.(n).catch(() => {});
}

// Optimistic: apply locally right away, sync in the background.
function write(id, patch) {
  patch = { ...patch, updatedAt: Date.now() };
  if (S.games[id]) S.games[id] = applyPatch(S.games[id], patch);
  Promise.resolve(S.store.updateGame(id, patch)).catch(err => {
    console.error(err);
    toast('Could not save. Check your connection.');
  });
}

function seenQuestionIds() {
  return new Set(Object.values(S.games).flatMap(g => g.rounds.flatMap(r => r.q || [])));
}

/* ---------- boot ---------- */

async function init() {
  try {
    S.store = await createStore();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="center"><p>Couldn't connect to the game server.</p>
      <p class="muted small">${esc(err.message)}</p>
      <button class="btn primary" onclick="location.reload()">Try again</button></div>`;
    return;
  }
  const pid = S.store.session.get();
  if (pid) S.me = await S.store.getPlayer(pid).catch(() => null);
  if (!S.me) { S.store.session.set(null); return go('welcome'); }
  start();
}

function start() {
  S.store.watchPlayers(ps => {
    S.players = ps;
    if (ps[S.me.id]) S.me = ps[S.me.id];
    refresh();
  });
  S.store.watchGames(S.me.id, gs => { S.games = gs; settleAll(); refresh(); });
  go('home');
}

// Finishes turns an interrupted session left half-done (e.g. the app was closed on the
// last question of a round), so the opponent isn't left waiting forever.
function settleAll() {
  for (const g of Object.values(S.games)) {
    if (S.view.name === 'question' && P.id === g.id && !P.answered) continue;
    const patch = G.settlePatch(g, S.me.id);
    if (patch) write(g.id, patch);
  }
}

/* ---------- small pieces ---------- */

function dots(arr, hidden = 0) {
  let out = '';
  for (let i = 0; i < G.PER_ROUND; i++) {
    if (i < arr.length) out += `<i class="dot ${arr[i] === 0 ? 'ok' : 'bad'}"></i>`;
    else if (i < arr.length + hidden) out += '<i class="dot hidden">?</i>';
    else out += '<i class="dot"></i>';
  }
  return `<span class="dots">${out}</span>`;
}

function catChip(catId) {
  const c = G.catById[catId];
  return c ? `<span class="chip" style="--c:${c.color}">${c.icon} ${esc(c.name)}</span>` : '';
}

function banners() {
  let out = '';
  if (isDemo) out += `<div class="banner">Demo mode: games are saved in this browser only. Open a second tab to play against yourself. See README to go online.</div>`;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (ios && !navigator.standalone) out += `<div class="banner tip">📲 Install it: tap <b>Share</b> then <b>Add to Home Screen</b>. Your player code (in your profile) logs you back in there.</div>`;
  return out;
}

function headToHead(oppId) {
  let w = 0, l = 0, d = 0;
  for (const g of Object.values(S.games)) {
    if (g.status !== 'finished' || !g.players.includes(oppId)) continue;
    if (!g.winner) d++; else if (g.winner === S.me.id) w++; else l++;
  }
  return { w, l, d };
}

function resultText(g) {
  const me = S.me.id;
  const opp = nameOf(g, G.opponentOf(g, me));
  if (g.resignedBy) return g.resignedBy === me ? 'You gave up' : `${esc(opp)} gave up`;
  if (!g.winner) return 'Draw';
  return g.winner === me ? 'You won! 🏆' : `${esc(opp)} won`;
}

function gameRow(g) {
  const me = S.me.id, opp = G.opponentOf(g, me);
  const [a, b] = G.scores(g, me);
  const step = G.nextStep(g, me);
  const round = Math.min(g.rounds.length, G.ROUNDS);
  const sub = step === 'over' ? resultText(g)
    : step === 'wait' ? `Waiting for ${esc(nameOf(g, opp))} · Round ${round}/${G.ROUNDS}`
    : `Your turn · Round ${round}/${G.ROUNDS}`;
  const cls = step === 'over' ? (g.winner === me ? 'won' : g.winner ? 'lost' : '') : step === 'wait' ? '' : 'turn';
  return `<button class="row ${cls}" data-act="open" data-arg="${g.id}">
    <span class="avatar sm">${initial(nameOf(g, opp))}</span>
    <span class="grow"><b>${esc(nameOf(g, opp))}</b><small>${sub}</small></span>
    <span class="score">${a}<em>–</em>${b}</span></button>`;
}

function section(title, list) {
  if (!list.length) return '';
  return `<h2 class="section">${title}</h2><div class="list">${list.map(gameRow).join('')}</div>`;
}

/* ---------- screens ---------- */

const VIEWS = {
  loading: () => `<div class="center muted">Loading…</div>`,

  welcome: ({ mode }) => `
    <div class="hero"><div class="logo big">Quiz<span>Duel</span></div>
      <p class="muted">Turn-based trivia with your friends. No ads, no coins, no nonsense.</p></div>
    ${banners()}
    ${mode === 'code' ? `
      <form class="card" data-submit="login">
        <label for="code">Your player code</label>
        <input id="code" name="code" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="e.g. K7Q2MD" required>
        <button class="btn primary">Log in</button>
      </form>
      <button class="link" data-act="welcome">I'm new here</button>` : `
      <form class="card" data-submit="register">
        <label for="name">What should we call you?</label>
        <input id="name" name="name" maxlength="20" autocomplete="nickname" placeholder="Your name" required>
        <button class="btn primary">Let's play</button>
      </form>
      <button class="link" data-act="welcome" data-arg="code">I already have a player code</button>`}`,

  home: () => {
    const me = S.me.id;
    const gs = Object.values(S.games);
    const mine = gs.filter(g => G.nextStep(g, me) === 'play' || G.nextStep(g, me) === 'pick').sort(byUpdated);
    const theirs = gs.filter(g => G.nextStep(g, me) === 'wait').sort(byUpdated);
    const done = gs.filter(g => g.status !== 'active').sort(byUpdated).slice(0, 15);
    return `
      <header class="topbar"><div class="logo">Quiz<span>Duel</span></div>
        <button class="avatar" data-act="go" data-arg="profile" aria-label="Profile">${initial(S.me.name)}</button></header>
      ${banners()}
      <button class="btn primary big" data-act="go" data-arg="new">⚡ New game</button>
      ${section('Your turn', mine)}
      ${section('Their turn', theirs)}
      ${section('Finished', done)}
      ${gs.length ? '' : `<p class="empty">No games yet. Start one and challenge a friend!</p>`}`;
  },

  new: () => {
    const others = Object.values(S.players).filter(p => p.id !== S.me.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    return `
      <header class="topbar"><button class="back" data-act="go" data-arg="home">‹</button><h1>New game</h1><span></span></header>
      <h2 class="section">Challenge</h2>
      <div class="list">${others.map(p => {
        const { w, l, d } = headToHead(p.id);
        return `<button class="row" data-act="challenge" data-arg="${p.id}">
          <span class="avatar sm">${initial(p.name)}</span>
          <span class="grow"><b>${esc(p.name)}</b><small>${w + l + d ? `You ${w}W · ${l}L · ${d}D` : 'No games yet'}</small></span>
          <span class="go">Play ›</span></button>`;
      }).join('') || `<p class="empty">Nobody else here yet.</p>`}</div>
      <div class="card">
        <p class="small muted">Friend not listed? Send them the link. Once they've picked a name they show up here.</p>
        <button class="btn" data-act="share">Share game link</button>
      </div>`;
  },

  game: ({ id }) => {
    const g = S.games[id];
    if (!g) return VIEWS.missing();
    const me = S.me.id, opp = G.opponentOf(g, me);
    const mine = G.answersOf(g, me), theirs = G.answersOf(g, opp);
    const shown = G.visibleOpponentAnswers(g, me);
    const [a, b] = G.scores(g, me);
    const step = G.nextStep(g, me);
    let rows = '';
    for (let ri = 0; ri < G.ROUNDS; ri++) {
      const r = g.rounds[ri];
      const my = mine.slice(ri * 3, ri * 3 + 3);
      const vis = shown.slice(ri * 3, ri * 3 + 3);
      const hidden = theirs.slice(ri * 3, ri * 3 + 3).length - vis.length;
      const reviewable = my.length === G.PER_ROUND;
      rows += `<button class="round ${reviewable ? '' : 'off'}" ${reviewable ? `data-act="review" data-arg="${ri}"` : 'disabled'}>
        ${dots(my)}
        <span class="rmid"><small>Round ${ri + 1}</small>${r?.category ? catChip(r.category) : r ? `<span class="chip ghost">${r.chooser === me ? 'Your pick' : `${esc(nameOf(g, opp))}'s pick`}</span>` : ''}</span>
        ${dots(vis, hidden)}</button>`;
    }
    const action = {
      play: `<button class="btn primary big" data-act="play">▶ Play round ${Math.floor(mine.length / 3) + 1}</button>`,
      pick: `<button class="btn primary big" data-act="play">▶ Choose a category</button>`,
      wait: `<div class="waiting">Waiting for ${esc(nameOf(g, opp))}…</div>`,
      over: `<div class="result ${g.winner === me ? 'won' : g.winner ? 'lost' : ''}">${resultText(g)}</div>
             <button class="btn primary big" data-act="challenge" data-arg="${opp}">↻ Rematch</button>`,
    }[step];
    const { w, l, d } = headToHead(opp);
    return `
      <header class="topbar"><button class="back" data-act="go" data-arg="home">‹</button><h1>vs ${esc(nameOf(g, opp))}</h1><span></span></header>
      <div class="board">
        <div class="side"><span class="avatar">${initial(S.me.name)}</span><b>You</b></div>
        <div class="bigscore">${a}<em>–</em>${b}</div>
        <div class="side"><span class="avatar opp">${initial(nameOf(g, opp))}</span><b>${esc(nameOf(g, opp))}</b></div>
      </div>
      <div class="rounds">${rows}</div>
      ${action}
      <p class="small muted center-text">Overall vs ${esc(nameOf(g, opp))}: ${w} won · ${l} lost · ${d} drawn</p>
      ${g.status === 'active' ? `<button class="link danger" data-act="resign">Give up this game</button>` : ''}`;
  },

  review: ({ id, ri }) => {
    const g = S.games[id];
    if (!g) return VIEWS.missing();
    const me = S.me.id, opp = G.opponentOf(g, me), r = g.rounds[ri];
    const mine = G.answersOf(g, me).slice(ri * 3, ri * 3 + 3);
    const theirs = G.visibleOpponentAnswers(g, me).slice(ri * 3, ri * 3 + 3);
    const cards = r.q.map((qid, qi) => {
      const q = G.getQuestion(qid);
      const opts = q.answers.map((txt, i) => {
        const tags = (mine[qi] === i ? `<span class="tag me">You</span>` : '') +
          (theirs[qi] === i ? `<span class="tag opp">${initial(nameOf(g, opp))}</span>` : '');
        const cls = i === 0 ? 'ok' : (mine[qi] === i || theirs[qi] === i) ? 'bad' : '';
        return `<li class="${cls}"><span>${esc(txt)}</span>${tags}</li>`;
      }).join('');
      const timeouts = [mine[qi] === -1 && 'You', theirs[qi] === -1 && esc(nameOf(g, opp))].filter(Boolean);
      return `<div class="card review"><p class="q">${esc(q.text)}</p><ul>${opts}</ul>
        ${timeouts.length ? `<p class="small muted">⏱ Out of time: ${timeouts.join(', ')}</p>` : ''}
        ${q.fact ? `<p class="fact">💡 ${esc(q.fact)}</p>` : ''}</div>`;
    }).join('');
    return `
      <header class="topbar"><button class="back" data-act="open" data-arg="${id}">‹</button><h1>Round ${ri + 1}</h1><span></span></header>
      <div class="center-text">${catChip(r.category)}</div>
      ${cards}`;
  },

  pick: ({ id }) => {
    const g = S.games[id];
    const ri = Math.floor(G.answersOf(g, S.me.id).length / 3);
    const r = g.rounds[ri];
    return `
      <header class="topbar"><button class="back" data-act="open" data-arg="${id}">‹</button><h1>Round ${ri + 1}</h1><span></span></header>
      <p class="center-text muted">Choose a category</p>
      <div class="cats">${r.options.map(c => {
        const cat = G.catById[c];
        return `<button class="cat" style="--c:${cat.color}" data-act="pickCat" data-arg="${c}">
          <span class="icon">${cat.icon}</span><span>${esc(cat.name)}</span></button>`;
      }).join('')}</div>`;
  },

  question: () => {
    const g = S.games[P.id], me = S.me.id, opp = G.opponentOf(g, me);
    const oppPick = P.answered ? G.answersOf(g, opp)[P.ri * 3 + P.qi] : undefined;
    const left = Math.max(0, P.deadline - Date.now()) / 1000;
    const answers = P.order.map(i => {
      let cls = '';
      if (P.answered) cls = i === 0 ? 'ok' : i === P.choice ? 'bad' : i === oppPick ? 'oppbad' : 'dim';
      const tag = oppPick === i ? `<span class="tag opp">${initial(nameOf(g, opp))}</span>` : '';
      return `<button class="ans ${cls}" data-act="answer" data-arg="${i}" ${P.answered ? 'disabled' : ''}>${esc(P.q.answers[i])}${tag}</button>`;
    }).join('');
    return `
      <div class="qhead">${catChip(P.q.cat)}<span class="muted">Question ${P.qi + 1}/3</span></div>
      <div class="timer"><i id="bar" style="width:${(left / G.TIME_LIMIT) * 100}%"></i><span id="secs">${Math.ceil(left)}</span></div>
      <div class="qcard"><p>${esc(P.q.text)}</p></div>
      ${P.answered && P.choice === -1 ? `<p class="center-text timeout">⏱ Time's up!</p>` : ''}
      <div class="answers">${answers}</div>
      ${P.answered && P.q.fact ? `<div class="fact"><b>💡 Did you know?</b> ${esc(P.q.fact)}</div>` : ''}
      ${P.answered ? `<button class="btn primary big next" data-act="next">${P.qi < 2 ? 'Next question ›' : 'Finish round ›'}</button>` : ''}`;
  },

  roundDone: ({ id, ri }) => {
    const g = S.games[id], me = S.me.id, opp = G.opponentOf(g, me);
    const mine = G.answersOf(g, me).slice(ri * 3, ri * 3 + 3);
    const theirs = G.answersOf(g, opp).slice(ri * 3, ri * 3 + 3);
    const step = G.nextStep(g, me);
    const n = G.correctCount(mine);
    const msg = ['Ouch.', 'Not bad.', 'Nice!', 'Perfect round! 🔥'][n];
    return `
      <div class="hero"><div class="bigscore">${n}<em>/</em>3</div><p>${msg}</p></div>
      <div class="board compact">
        <div class="side"><b>You</b>${dots(mine)}</div>
        <div class="side"><b>${esc(nameOf(g, opp))}</b>${theirs.length ? dots(theirs) : '<small class="muted">plays next</small>'}</div>
      </div>
      ${step === 'pick' ? `<button class="btn primary big" data-act="play">Choose next category ›</button>`
        : step === 'over' ? `<div class="result ${g.winner === me ? 'won' : g.winner ? 'lost' : ''}">${resultText(g)}</div>
           <button class="btn primary big" data-act="open" data-arg="${id}">See the game</button>`
        : `<p class="center-text muted">Now it's ${esc(nameOf(g, opp))}'s turn.</p>
           <button class="btn primary big" data-act="open" data-arg="${id}">Back to game</button>`}
      <button class="link" data-act="go" data-arg="home">Home</button>`;
  },

  profile: () => {
    const fin = Object.values(S.games).filter(g => g.status === 'finished');
    const w = fin.filter(g => g.winner === S.me.id).length;
    const d = fin.filter(g => !g.winner).length;
    return `
      <header class="topbar"><button class="back" data-act="go" data-arg="home">‹</button><h1>Profile</h1><span></span></header>
      <form class="card" data-submit="rename">
        <label for="name">Name</label>
        <input id="name" name="name" maxlength="20" value="${esc(S.me.name)}" required>
        <button class="btn">Save name</button>
      </form>
      <div class="card">
        <label>Your player code</label>
        <div class="code">${esc(S.me.code)}</div>
        <p class="small muted">Use it to log in on another device, or in the Home Screen app if you started in Safari. Keep it to yourself.</p>
      </div>
      <div class="card stats">
        <div><b>${fin.length}</b><small>played</small></div>
        <div><b>${w}</b><small>won</small></div>
        <div><b>${fin.length - w - d}</b><small>lost</small></div>
        <div><b>${d}</b><small>drawn</small></div>
      </div>
      <button class="link" data-act="logout">Log out of this device</button>
      ${isDemo ? `<button class="link danger" data-act="resetDemo">Wipe demo data</button>` : ''}`;
  },

  missing: () => `
    <header class="topbar"><button class="back" data-act="go" data-arg="home">‹</button><h1></h1><span></span></header>
    <p class="empty">This game isn't available.</p>`,
};

/* ---------- playing a round ---------- */

function startTurn(id) {
  const g = S.games[id];
  const step = G.nextStep(g, S.me.id);
  if (step === 'pick') return go('pick', { id });
  if (step === 'play') { P.id = id; return showQuestion(); }
  go('game', { id });
}

function commitAnswers(arr, final) {
  const me = S.me.id;
  let patch = { [`answers.${me}`]: arr };
  if (final) {
    const settle = G.settlePatch(applyPatch(S.games[P.id], patch), me);
    if (settle) patch = { ...patch, ...settle };
  }
  write(P.id, patch);
}

function showQuestion() {
  const g = S.games[P.id], me = S.me.id;
  const mine = [...G.answersOf(g, me)];
  const ri = Math.floor(mine.length / 3), qi = mine.length % 3;
  // Saved as "out of time" up front, so closing the app mid-question doesn't allow a retry.
  mine.push(-1);
  commitAnswers(mine, false);
  Object.assign(P, {
    ri, qi, q: G.getQuestion(g.rounds[ri].q[qi]), order: G.shuffle([0, 1, 2, 3]),
    answered: false, choice: null, deadline: Date.now() + G.TIME_LIMIT * 1000,
  });
  go('question');
  clearInterval(timer);
  timer = setInterval(tick, 100);
}

function tick() {
  const left = Math.max(0, P.deadline - Date.now()) / 1000;
  const bar = document.getElementById('bar'), secs = document.getElementById('secs');
  if (bar) {
    bar.style.width = `${(left / G.TIME_LIMIT) * 100}%`;
    bar.classList.toggle('low', left <= 5);
  }
  if (secs) secs.textContent = Math.ceil(left);
  if (left <= 0) answer(-1);
}

function answer(choice) {
  if (P.answered) return;
  clearInterval(timer);
  P.answered = true;
  P.choice = choice;
  const mine = [...G.answersOf(S.games[P.id], S.me.id)];
  mine[mine.length - 1] = choice;
  commitAnswers(mine, mine.length % 3 === 0);
  render();
}

/* ---------- actions ---------- */

const ACTIONS = {
  go: arg => go(arg),
  welcome: arg => go('welcome', { mode: arg }),
  open: id => go('game', { id }),
  review: ri => go('review', { id: S.view.id, ri: +ri }),
  play: () => startTurn(S.view.id ?? P.id),
  pickCat: cat => {
    const id = S.view.id, g = S.games[id];
    const ri = Math.floor(G.answersOf(g, S.me.id).length / 3);
    if (!g.rounds[ri] || g.rounds[ri].category) return startTurn(id);
    const q = G.pickQuestions(cat, g, seenQuestionIds());
    write(id, { rounds: g.rounds.map((r, i) => i === ri ? { ...r, category: cat, q } : r) });
    P.id = id;
    showQuestion();
  },
  answer: i => answer(+i),
  next: () => {
    if (P.qi < 2) showQuestion();
    else go('roundDone', { id: P.id, ri: P.ri });
  },
  challenge: oppId => {
    const me = S.me.id;
    const opp = S.players[oppId];
    const g = G.newGame(me, oppId, { [me]: S.me.name, [oppId]: opp?.name || 'Someone' });
    const id = S.store.createGame(g);
    S.games[id] = { ...g, id };
    go('pick', { id });
  },
  resign: () => {
    const g = S.games[S.view.id];
    if (!confirm(`Give up against ${nameOf(g, G.opponentOf(g, S.me.id))}? It counts as a loss.`)) return;
    write(g.id, G.resignPatch(g, S.me.id));
    render();
  },
  share: async () => {
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) await navigator.share({ title: 'Quiz Duel', text: 'Come play Quiz Duel with me!', url });
      else { await navigator.clipboard.writeText(url); toast('Link copied'); }
    } catch { /* share sheet dismissed */ }
  },
  logout: () => {
    if (!confirm(`Log out? You'll need your code ${S.me.code} to log back in.`)) return;
    S.store.session.set(null);
    location.reload();
  },
  resetDemo: async () => {
    if (!confirm('Delete all demo players and games?')) return;
    await S.store.reset();
    location.reload();
  },
};

const SUBMITS = {
  register: async f => {
    const name = f.name.value.trim();
    if (!name) return;
    S.me = await S.store.createPlayer(name);
    S.store.session.set(S.me.id);
    start();
  },
  login: async f => {
    const p = await S.store.findPlayerByCode(f.code.value.trim().toUpperCase());
    if (!p) return toast('No player with that code');
    S.me = p;
    S.store.session.set(p.id);
    start();
  },
  rename: async f => {
    const name = f.name.value.trim();
    if (!name || name === S.me.name) return;
    await S.store.updatePlayer(S.me.id, { name });
    S.me = { ...S.me, name };
    toast('Saved');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) ACTIONS[el.dataset.act]?.(el.dataset.arg, el);
});

document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-submit]');
  if (!f) return;
  e.preventDefault();
  const btn = f.querySelector('button');
  btn.disabled = true;
  try { await SUBMITS[f.dataset.submit](f); }
  catch (err) { console.error(err); toast('Something went wrong. Try again.'); }
  finally { btn.disabled = false; }
});

init();

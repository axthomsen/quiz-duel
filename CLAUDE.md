# Quiz Duel — notes for agents

A private, ad-free clone of the QuizDuel trivia app, played by the owner and a friend on iPhones as a
home-screen web app (PWA). No build step, no framework, no npm: plain ES modules served as static files.
It's also used as a learning tool, so **factual accuracy of questions matters more than quantity**.

- Live site: https://axthomsen.github.io/quiz-duel/ (GitHub Pages, `main` branch, repo root)
- Backend: Firebase project `quiz-duel-a12e3` on the free **Spark** plan (Firestore + anonymous auth)
- There's no Node or Python on the owner's PC. Use PowerShell / Git Bash and the browser.

## Files

| Path | Role |
| --- | --- |
| `index.html`, `styles.css` | Shell and all styling (dark theme, mobile-first, safe-area insets) |
| `app.js` | UI: a `VIEWS` object of render functions returning HTML strings, `ACTIONS` for `data-act` clicks, `SUBMITS` for `data-submit` forms. State lives in `S` (session) and `P` (the round being played) |
| `logic.js` | Pure game rules: turn order, scoring, question/category picking. No DOM, no I/O |
| `store.js` | Backend adapter with one API, two implementations: Firestore, or a localStorage "demo" store |
| `questions.js` | Category list (id, name, icon, color) + imports of `questions/<id>.js` |
| `questions/<id>.js` | One file per category: `[question, rightAnswer, wrong1, wrong2, wrong3, explanation]` |
| `firebase-config.js` | Public Firebase web config (safe to commit; the rules protect data) |
| `firestore.rules` | Security rules. **Not deployed by git push**; the owner pastes them in the Firebase console |
| `sw.js` | Service worker: network-first with cache fallback. Lists every file to cache offline |
| `dev/check.html` | Self-check page (see Testing) |
| `serve.ps1` | Static dev server on http://localhost:8123 (`.claude/launch.json` runs it) |

## Data model (Firestore)

- `players/{id}`: `{ name, code, createdAt }`. `code` is a 6-char login code shown in the profile, used to
  restore a player on another device. Player identity is the doc id saved in localStorage
  (`quizduel.player`), **not** the Firebase auth uid; anonymous auth only gates database access.
- `games/{id}`: `{ players: [a, b], names, status: 'active'|'finished', turn, rounds: [{ chooser, options[3],
  category|null, q[3] }], answers: { [playerId]: number[] }, winner, resignedBy, createdAt, updatedAt }`.
  `answers` is flat, 3 per round: `0` = correct, `1–3` = which wrong answer, `-1` = out of time.
  Each player only writes `answers.<ownId>` (dotted-path update), so the two players never overwrite each other.

## Game flow (logic.js)

6 rounds × 3 questions, 20 s each. The challenger picks round 1's category (from 3 random ones) and plays
it. Then the turn passes: the other player plays that round, picks round 2, plays it, and so on.
`settlePatch()` runs after a round is finished and decides whether to hand over the turn, open the next round,
or end the game. `settleAll()` in app.js re-runs it on every data update, to repair games left half-done
when the app was closed mid-turn. Before each question is shown, a `-1` is saved first, so reloading
can't be used to retry a question.

Opponent results for a round stay hidden until you've played that round (`visibleOpponentAnswers`).

## Rules for questions (read before adding any)

1. **Append only.** A question's id is `<category>-<index>` and games store those ids. Never insert,
   reorder or delete lines in `questions/*.js`; only add to the end. Fixing a typo or a wrong fact in place
   is fine, as long as the line stays in its position. `dev/check.html` compares against the live site to catch mistakes.
2. **The first answer is the right one.** The app shuffles the four answers.
3. **Accuracy first.** Only well-established facts. No contested claims (e.g. "who invented the light
   bulb", "country with the most islands"). Anything that can change (records, "the biggest", rankings)
   must say "As of <year>" in the question.
4. **Wrong answers must be unambiguously wrong**, but plausible. Check that no distractor is also
   correct (e.g. don't offer both "homograph" and "heteronym").
5. **Every question has an explanation** (shown as "Did you know?" after answering): one or two short
   sentences, about 60–200 characters, that teach something beyond the answer. Ideally it explains why a
   tempting wrong answer is wrong. Use hedges ("reportedly", "legend says") for anything uncertain.
6. Each category needs at least 9 questions (a game can draw 3 rounds from one category). Aim for 30+.
7. Strings use single quotes with `\'` escapes, matching the existing files.

## Adding a category

1. Create `questions/<id>.js` (`export default [ ... ];`).
2. In `questions.js`, import it and add it to both `CATEGORIES` and `QUESTIONS`.
3. In `sw.js`, add the id to `CATEGORY_FILES` and **bump `CACHE`**.
4. Run `dev/check.html`.

## Testing

- Start the dev server (launch config `quiz-duel`, or `powershell -ExecutionPolicy Bypass -File serve.ps1`).
- **Use `?demo` for anything that creates players or games**: http://localhost:8123/?demo . Demo mode keeps
  data in localStorage, and each browser tab is a separate player, so you can play both sides in two tabs.
  Without `?demo`, localhost talks to the **real** Firebase database the owner plays on.
- Open http://localhost:8123/dev/check.html after any change to questions or logic. It validates every
  question, compares with the live site, simulates 25 games and checks the offline cache list. Read
  `window.checkResult` (`{ ok, failures, warnings }`) from the page with JS.
- UI: test at phone width (375 px). The app is used on iPhones from the home screen.

## Deploying

Commit and push to `main`; GitHub Pages redeploys in about a minute
(`curl -s https://api.github.com/repos/axthomsen/quiz-duel/actions/runs?per_page=1` shows status).
Phones pick up changes on their next launch (network-first service worker, which revalidates every file
so phones don't mix old and new files). Firestore rule changes must be pasted into the Firebase console by the owner.

After deploying, open https://axthomsen.github.io/quiz-duel/dev/check.html. GitHub's CDN and the browser cache
files for up to 10 minutes (`max-age=600`), so a check run right after the deploy can briefly see old files.

## Constraints

- Stay on the free Spark plan. Never suggest upgrading to Blaze; features needing it (push notifications
  via Cloud Functions) are out of scope unless the owner asks.
- No accounts, no passwords, no tracking, no ads, nothing that costs money.
- Known, accepted limitation: the rules trust every signed-in client, so anyone with the link could read
  player codes or edit games. Fine for two friends; tighten the rules if the link is ever shared widely.

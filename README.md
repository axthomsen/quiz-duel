# Quiz Duel

A private, ad-free take on the classic turn-based trivia duel. It's a web app you add to your
iPhone home screen, where it opens full-screen like a normal app.

**Play:** https://axthomsen.github.io/quiz-duel/

- 6 rounds × 3 questions, 20 seconds per question
- Players take turns choosing a category (from 3 random ones), and both answer the same questions
- You can't see your opponent's results for a round until you've played it, then you can see what they picked
- A "Did you know?" explanation after every question
- Several games at once, rematches, head-to-head record, round review
- 1,155 questions in 26 categories, from easy to hard

## Install on an iPhone

1. Open the link in **Safari** (it has to be Safari).
2. Tap **Share → Add to Home Screen → Add**.
3. Open it **from the home screen icon** and pick your name there.

The home screen app keeps its own storage, separate from Safari. If you made a player in Safari
first, open your **Profile** there, note your **player code**, and use "I already have a player
code" inside the home screen app. The same code moves you to a new phone.

## Updating

- **New questions:** add a line to the end of a category file in `questions/`, in the form
  `['Question?', 'Right answer', 'Wrong 1', 'Wrong 2', 'Wrong 3', 'Did-you-know explanation'],`.
  Never reorder or delete existing lines, because games point at questions by position.
  [CLAUDE.md](CLAUDE.md) has the full rules, including how to add a category.
- Push to `main` on GitHub and the site updates in about a minute. Phones pick up the new
  version the next time the app is opened (sometimes it takes two launches).

## Testing on this PC

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

- http://localhost:8123/?demo plays in **demo mode**: data stays in the browser and each tab is a
  separate player, so you can play against yourself. Without `?demo`, it uses the real database.
- http://localhost:8123/dev/check.html checks every question, compares with the live site, and
  simulates games.

## How it's hosted

- **GitHub Pages** serves the files (repo `axthomsen/quiz-duel`, `main` branch, root folder).
- **Firebase** (project `quiz-duel-a12e3`, free Spark plan) stores players and games, with
  anonymous sign-in. The rules in `firestore.rules` are pasted into the Firebase console by hand;
  pushing to GitHub doesn't update them. The site's domain is listed under Authentication →
  Settings → Authorized domains.
- Never upgrade Firebase to the Blaze plan: it's the only way this could ever cost money.

## Not included (yet)

- **Push notifications** ("your turn!"). On iPhone these need a small server (Firebase Cloud
  Functions, which requires the paid Blaze plan). For now, the app icon badge and the "(1)" in
  the title show games waiting for you.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `styles.css` | Page and look |
| `app.js` | Screens and gameplay |
| `logic.js` | Game rules (turns, scoring, question picking) |
| `store.js` | Saving data: Firebase, or the browser in demo mode |
| `questions.js` | Category list (names, icons, colors) |
| `questions/*.js` | The questions, answers and explanations, one file per category |
| `firebase-config.js` | Firebase connection settings (public by design) |
| `firestore.rules` | Database security rules to paste into Firebase |
| `sw.js`, `manifest.webmanifest`, `icons/` | Makes it installable / work offline |
| `serve.ps1`, `dev/check.html` | Local test server and self-check page |
| `CLAUDE.md` | Guide for AI agents working on the project |

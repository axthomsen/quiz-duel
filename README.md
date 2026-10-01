# Quiz Duel

A private, ad-free take on the classic turn-based trivia duel. It's a web app you add to your
iPhone home screen, where it opens full-screen like a normal app.

- 6 rounds × 3 questions, 20 seconds per question
- Players take turns choosing a category (from 3 random ones), and both answer the same questions
- You can't see your opponent's results for a round until you've played it, then you can see what they picked
- Several games at once, rematches, head-to-head record, round review
- 774 questions in 21 categories (`questions.js`). Add your own anytime

## Try it on this PC (demo mode)

While `firebase-config.js` is empty, the game runs in **demo mode**: everything is saved in the
browser, and each tab is a separate player, so you can play against yourself in two tabs.

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:8123.

## Put it online (one-time, ~15 minutes, free)

You need two free accounts: **Firebase** (stores the games) and **GitHub** (hosts the app).

### 1. Firebase (the shared game database)

1. Go to https://console.firebase.google.com and click **Create a project** (name it e.g. `quiz-duel`).
   You can turn Google Analytics off.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
   (Players don't need passwords. Each phone signs in invisibly.)
3. **Build → Firestore Database → Create database.** Pick a location near you (e.g. `eur3`),
   start in **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`,
   and click **Publish**.
5. **Project settings** (gear icon) → **Your apps** → click the **</>** (Web) icon → give it a
   nickname → **Register app**. You'll see a `firebaseConfig = { ... }` block.
6. Copy those values into `firebase-config.js` in this folder.

The free "Spark" plan is far more than two people will ever use.

### 2. GitHub Pages (the web address)

1. Create an account at https://github.com if you don't have one.
2. Click **New repository**, name it `quiz-duel`, set it to **Public**, and create it.
3. On the empty repo page click **uploading an existing file** and drag in **everything in this
   folder** (including the `icons` folder), then **Commit changes**.
4. Repo **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**,
   choose branch **main** and folder **/ (root)**, then **Save**.
5. After a minute, your app is live at `https://<your-username>.github.io/quiz-duel/`.
6. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** →
   `<your-username>.github.io`.

(The Firebase config values aren't secret. They're meant to be in web pages. The rules are
what protect the data.)

### 3. Install on the iPhones

1. Open the link in **Safari** (it has to be Safari).
2. Tap **Share → Add to Home Screen → Add**.
3. Open it **from the home screen icon** and pick your name there.

The home screen app keeps its own storage, separate from Safari. If you made a player in Safari
first, open your **Profile** there, note your **player code**, and use "I already have a player
code" inside the home screen app.

Send your friend the link and the same steps. Once they've picked a name, they show up under
**New game**.

## Updating

- **New questions:** add a line to the end of a category file in `questions/`, in the form
  `['Question?', 'Right answer', 'Wrong 1', 'Wrong 2', 'Wrong 3', 'Did-you-know explanation'],`.
  Never reorder or delete existing lines, because games point at questions by position.
- After changing files, upload them to the GitHub repo again (drag & drop, commit). Phones pick
  up the new version the next time the app is opened (sometimes it takes two launches).

## Not included (yet)

- **Push notifications** ("your turn!"). On iPhone these need a small server (Firebase Cloud
  Functions, which requires adding a billing card even though it'd stay free at this scale).
  For now, the app icon badge and the "(1)" in the title show games waiting for you.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `styles.css` | Page and look |
| `app.js` | Screens and gameplay |
| `logic.js` | Game rules (turns, scoring, question picking) |
| `store.js` | Saving data: Firebase, or the browser in demo mode |
| `questions.js` | Category list (names, icons, colors) |
| `questions/*.js` | The questions, answers and explanations, one file per category |
| `firebase-config.js` | Your Firebase keys (empty = demo mode) |
| `firestore.rules` | Database security rules to paste into Firebase |
| `sw.js`, `manifest.webmanifest`, `icons/` | Makes it installable / work offline |
| `serve.ps1` | Local test server |

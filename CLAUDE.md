# Merlin workflow

Solo-developer project. Only user is Victor. No other stakeholders, no QA, no staging users. **Velocity over caution.**

## Git workflow

1. **Work directly on `main`.** No feature branches unless Victor explicitly asks.
2. **No preview deploys.** Push straight to prod.
3. **Auto-commit and auto-push after every change.** Do not ask "want me to commit?" or "ready to push?" — just do it with a clear message.
4. **Atomic commits with descriptive messages**, so specific commits can be reverted later if needed.
5. **Fix-forward, don't revert** unless Victor asks. If something breaks in prod, he'll tell you the error and you fix it in the next commit.
6. **No local testing ceremony.** If it compiles (`tsc`/build passes), ship it. Don't run the dev server, don't write throwaway test scripts, don't ask to verify.

## When to pause and ask first

Only stop for approval when about to:
- Delete files
- Touch auth, billing, or Firestore security rules (`firestore.rules`)
- Refactor across 5+ files
- Make a change you're less than 80% confident about

Everything else: just do it.

## Project facts

- Firebase project: **`candidate-search-492720`** (not the Gemini project `gen-lang-client-0689322783` — easy to confuse because the app uses Gemini).
- Firebase config: `firebase-applet-config.json` (imported directly in `src/lib/firebase.ts`, no env-var layer).
- Deploy target: Vercel, auto-deploys from `main` to prod.

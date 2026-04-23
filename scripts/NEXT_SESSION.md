# Handoff — pick up from here

**Goal:** verify the in-flight Gemini change works on the Vercel preview deploy for talentwizard.ai, then merge to main.

## State of the change
- Branch: `feat/gemini-grounded-fingerprint` (pushed to origin)
- Commit: `231b02d feat(gemini): enable Google Search grounding for technical fingerprint extraction`
- Diff: 3 lines added to `src/services/gemini.ts` — adds `tools: [{ googleSearch: {} }]` to `extractTechnicalFingerprint` so company/job URLs actually get fetched instead of string-concatenated into the prompt
- **Not yet merged to main. Not yet verified on preview deploy.**

## Last blocker (now resolved)
Vercel preview deploy failed auth with `auth/unauthorized-domain`. Root cause: Firebase project `candidate-search-492720` was owned by `victorpadams@gmail.com`, not the working account `victor@materialg.com`. Resolution: on 2026-04-23 Victor added `materialg` as Owner via the gmail account and accepted the invite.

## Next steps (in order)
1. In Firebase Console as `victor@materialg.com`, open project `candidate-search-492720` → Authentication → Settings → Authorized domains → add the Vercel preview URL (something like `merlin-git-feat-gemini-grounded-fingerprint-materialg.vercel.app`).
2. Hard-refresh the preview in incognito. Sign in should now work.
3. Run a test query with a company URL (e.g. prompt: "senior systems engineer for a small security-focused startup", company link: `https://inferact.ai`).
4. In DevTools → Network → filter `generativelanguage.googleapis.com`, inspect the first call. Look for `candidates[0].groundingMetadata` in the response body.
5. **If grounding fires cleanly (metadata present, no 400 error):** merge `feat/gemini-grounded-fingerprint` into `main` (single commit, no squash, per Victor's preference).
6. **If call errors with "tools not compatible with responseSchema" or similar:** push a fallback commit to the same branch that drops the `tools` block and adds URL-fetch instructions to the prompt instead. Re-test preview.
7. After merge, Vercel auto-deploys to talentwizard.ai. Victor should re-test on prod with a query that uses a company URL.

## Victor's standing rules for this repo
- Show the diff. Don't commit without approval. Single commit, no squash.
- Preview deploy test gates every merge. Don't shortcut to main.
- Stay on Gemini Flash (not Pro). Bad-result problems are data-availability (LinkedIn blocks crawlers), not model-reasoning.
- Retry floor stays at 2s.

## Environment notes
- Node 25.9 and npm 11.12 installed via Homebrew on 2026-04-23 — fresh install, persists.
- `.env` exists at repo root with a `GEMINI_API_KEY` that returned `API_KEY_INVALID` from a Node script (likely has referrer restrictions or is stale). **Do not rely on local Gemini calls.** Use the preview deploy for live testing.
- `scripts/test-grounding.ts` is a local-only diagnostic script; leave untracked.
- Git identity is not set globally on this machine. Use `git -c user.name="Material Group" -c user.email="victorpadams@gmail.com"` for commits to match existing history.

## Known issues worth flagging separately (out of scope for this PR)
- URL hallucination on LinkedIn profiles — the structural problem. Real fix: people-data API (Apollo/PDL/Clay) + URL liveness check server route.
- Enrichment loop is sequential with no parallelization (App.tsx:231).
- Gemini API key is in the client bundle; needs HTTP referrer + quota lock-down in GCP Console.

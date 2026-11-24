# CV Wrapped

Upload a CV and get a set of story cards about what's actually in it: your top verbs, your biggest number, your shape on three axes, an animal archetype, an estimated level, the roles your evidence supports, and one plot twist with a bullet rewrite.

## The one principle

**The LLM extracts, code decides.** The model only turns the CV into structured facts per bullet (copied word for word). Everything on the cards is computed in `lib/wrapped.ts` from those facts, so the same CV gives the same result, and every card can point to the bullets behind it.

| Step | Who | File |
|---|---|---|
| Parse PDF / DOCX / TXT | code (unpdf, mammoth) | `lib/parse.ts` |
| Extract per-bullet facts | Claude (Sonnet 5.5), structured JSON output | `lib/extract.ts` |
| Sanitise | code: drops any bullet not found in the CV text, and any metric, signal or artefact not literally in its bullet | `lib/sanitise.ts` |
| Score and pick | code: axes, animal, hero stat, verbs, level, roles, receipts, plot twist | `lib/wrapped.ts` |
| Rewrite one bullet | Claude, one call; rejected if it adds numbers or names, or runs past 24 words | `lib/extract.ts` |

### Fixes for the old Skill Mapper problems

- **Stale results:** the API sends `Cache-Control: no-store`, nothing is saved in the browser or on the server, and only the newest upload can update the screen. The first card shows the file name, pages, headline and bullet count so you can see the right CV was read.
- **Misreading:** a bullet is kept only if 85% of it matches the CV text. If the model's answer doesn't match the file at all, the app stops with an error instead of showing someone else's results. Scanned PDFs get a clear message.
- **Dead model:** the old app called `llama-3.3-70b-versatile` on Groq, which was shut down on 16 Aug 2026. This uses the Claude API (`claude-sonnet-5-5` by default; set `CLAUDE_MODEL=claude-haiku-5-5` for a cheaper run).

## The logic

- **Framing ↔ Making:** verbs from a fixed lexicon (`lib/lexicon.ts`), not the LLM. A bullet's first verb weighs 1, others 0.5. Score = making / (framing + making).
- **Deep ↔ Wide:** domains and disciplines with 2+ bullets each. `0.5·(domains−1)/3 + 0.5·(disciplines−1)/3`.
- **Solo ↔ Crowd:** share of bullets that involve other people, mapped so 10% → 0 and 70% → 1.
- **Animal:** each pole wins at ≥ 0.5, giving 8 animals (`lib/archetypes.ts`).
- **Biggest flex:** before→after > % change > money > rating > count > time. Percentages rank by points gained, not ratio.
- **Level:** Dreyfus stage from years (stated years first, then dated roles). Moves up one step at most, only with 4+ scope signals and within a year of the next band.
- **Plot twist:** the first rule that fires: design headline with mostly framing/people verbs and few artefacts; headline discipline under 60% of bullets; under 25% of bullets with numbers; otherwise the positive version.

## Look

Matches the Figma file with fewer elements: one colour per card (cream, orange, ink, lime, pink, blue), Inter Tight for display, Instrument Serif italic for the one supporting line per card. Animal illustrations live in `public/animals/` as 640px WebP.

## Run locally

```bash
npm install
cp .env.example .env.local   # add your Anthropic API key
npm run dev
npm test                     # engine tests on a real CV fixture
```

## Deploy on Vercel

1. Import this repo in Vercel.
2. Add `ANTHROPIC_API_KEY` under Settings > Environment Variables with **Production** ticked.
3. Deploy. If the key is missing, the app says so instead of failing with a blank 500.

## Open items

- The name: "Wrapped" is Spotify's campaign name. Pick your own before promoting it publicly.
- The verb lexicon is design-centric. Test a few non-design CVs and retune if everyone comes out the same animal.

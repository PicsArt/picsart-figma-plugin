# Contributing

Thank you for your interest in contributing to the **AI Image Generator & Editor by
Picsart** Figma plugin.

This file used to be the generic Picsart Creative APIs SDK guide. It described a
`/tests/` directory, an `/examples/` directory and Python and Java style guides — none of
which exist here; tests live in `__tests__/` beside the code, and this is a TypeScript
repo. It is the file GitHub surfaces in the contribute flow, so a contributor's first
instruction was to set up the wrong toolchain. What follows describes this repository.

## Before you start

- **[`README.md`](README.md)** — build, load into Figma, and the API-key step that
  otherwise leaves you looking at a blank panel.
  It also carries the two runtime contexts, the postMessage seam and the traps — read
  that part before touching anything that crosses between the sandbox and the UI, which
  is most things.

## The one thing to internalise

**Every button in this plugin spends the user's credits.** A call that fires twice is a
double charge with nothing on screen to show it happened, and a result that arrives and
is then dropped is money gone. Most of the defensive code in this repository, and most of
the comments explaining it, exist because one of those happened.

## Layout

| Path | |
|---|---|
| `src/` | the UI iframe — React, `fetch`, **no `figma`** |
| `constants/` `controllers/` `routes/` `services/` | the sandbox — `figma.*`, restricted network |
| `scripts/` | gate checks that are not lint, tests or a build |

Sandbox code lives outside `src/` deliberately. An eslint rule blocks the `figma` global
under `src/**` because TypeScript will not catch it there.

## Before you push

```bash
npm run gate
```

Seven stages, and **none of them subsumes another**:

| Stage | The only thing that catches |
|---|---|
| `typecheck` | type errors under `src/` |
| `lint` | Figma-plugin API mistakes, e.g. `getNodeById` under `documentAccess: dynamic-page` |
| `test:run` | behavioural regressions |
| `build` | a comment ending in the word "import", which stops the plugin loading — production strips comments, so `build:prod` cannot see it |
| `check:bundle` | UI-only code in the sandbox bundle. Reads the **dev** build on purpose: production tree-shaking removes the violation, so the only bundle carrying it is the one `npm run watch` feeds to Figma |
| `check:eval` | whether `dist/code.js` **runs at all**. Everything above it reads the source or imports modules directly, so a bundle that throws on its first line passed the whole gate — and the symptom in Figma is a plugin that never starts. Caught live once: `npm run watch` wrote a bundle mid-edit with a constant referenced above its own declaration, and Figma loaded it |
| `build:prod` | the real production config |

A change that passes six of the seven can still ship broken. `build:prod` should finish
with **zero warnings**; treat a new one as a real finding.

**Nothing runs this automatically.** There is no CI on this repository and `dist/` is
gitignored, so the gate is only ever as good as the last person who remembered to run it.
Run it before you push, and again before you publish.

## Tests

Vitest. Tests live in `__tests__/` directories beside the code they cover. Default
environment is `node`; a component test opts into jsdom with a
`// @vitest-environment jsdom` docblock on line 1.

The suite needs **no API key and no network**, and that is the point — it is the loop to
work in, because the alternative costs credits per run. Stub at the `@api` and
`@utils/placement` boundaries.

Two things jsdom cannot do, so do not write tests that depend on them:
`createImageBitmap` does not exist, and `Image.onload` never fires for a blob URL.
Anything needing a real image decode is manual-QA territory.

Sandbox code is tested through the **injected `PluginAPI`** seam
(`services/__tests__/figmaStub.ts`), not a global stub. Keep that seam when you add a
function there.

## Pull requests

- A branch per feature.
- Small, self-contained, and worth reviewing on their own.
- **[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html).**
- Add tests for new behaviour, and for any bug you fix on a paid path.
- **Two approvals required**, from code owners of the repository.
- Merging is done by Picsart.

### Comments

This repository comments *why*, at the decision, not *what*. A comment that explains the
bug a guard exists to prevent is what stops the guard being "simplified" away a year
later — see `src/api/apiError.ts`, `services/UiBridge.ts` or
`src/utils/actionButton.ts` for the house style. A comment that restates the code is
noise; a stale one is worse than none, so delete it when the code moves out from under
it.

## Releasing

See [`RELEASING.md`](RELEASING.md). Release notes also appear at
[Creative APIs Releases](https://docs.picsart.io/docs/creative-apis-releases).

## Licence

MIT — see [LICENSE](./LICENSE). By using, distributing, or contributing to this project
you agree to its terms.

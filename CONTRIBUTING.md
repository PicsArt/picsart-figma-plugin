# Contributing

Thank you for your interest in contributing to the **BG Remover & Image Enhancer by
Picsart** Figma plugin.

This file used to be the generic Picsart Creative APIs SDK guide. It described a
`/tests/` directory, a `/scripts/` directory, an `/examples/` directory and Python and
Java style guides — none of which exist here. It is the file GitHub surfaces in the
contribute flow, so a contributor's first instruction was to set up the wrong toolchain.
What follows describes this repository.

## Before you start

- **[`README.md`](README.md)** — build, load into Figma, and the API-key step that
  otherwise leaves you looking at a blank panel.
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — the two runtime contexts, the
  postMessage seam, and the traps. Read this before touching anything that crosses
  between the sandbox and the UI, which is most things.
- **[`TODOS.md`](TODOS.md)** — deferred work, with enough context to pick up cold.

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
| `docs/` | architecture and design specs |

Sandbox code lives outside `src/` deliberately. An eslint rule blocks the `figma` global
under `src/**` because TypeScript will not catch it there.

## Before you push

```bash
npm run gate
```

Five stages, and **none of them subsumes another**:

| Stage | The only thing that catches |
|---|---|
| `typecheck` | type errors under `src/` |
| `lint` | Figma-plugin API mistakes, e.g. `getNodeById` under `documentAccess: dynamic-page` |
| `test:run` | behavioural regressions |
| `build` | a comment ending in the word "import", which stops the plugin loading — production strips comments, so `build:prod` cannot see it |
| `build:prod` | the real production config |

A change that passes four of the five can still ship broken. `build:prod` should finish
with **zero warnings**; treat a new one as a real finding.

CI runs the same gate on every pull request.

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

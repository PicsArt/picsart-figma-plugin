# BG Remover & Image Enhancer by Picsart — Figma plugin

A Figma plugin that calls the Picsart Creative APIs to remove backgrounds, enhance and upscale
images, and generate images from a text prompt. TypeScript + React, bundled with webpack.

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the detailed reference — the two runtime
contexts, the postMessage seam, and the traps. This file is the short version.

This pointer used to name `CLAUDE.md`, which `.gitignore` excludes along with every other
agent file. The architecture doc is tracked so that a clone contains the document a clone is
told to read.

## Running it

```bash
npm install
npm run watch      # development build, rebuilds on change
npm run gate       # typecheck + lint + tests + production build. Run before pushing.
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | one-off development build to `dist/` |
| `npm run build:prod` | production build (minified, no source maps) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | `eslint .` |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest once |
| `npm run gate` | all of the above that matter, in order |

**There is no `npm start`.** It used to exist and was a trap: `webpack.config.js` has no
`devServer` block, so `webpack serve` wrote nothing to `dist/` while `manifest.json` points at
`dist/code.js` and `dist/ui.html`. Figma silently loaded a stale build. Use `npm run watch`.

Node 20 (see `.nvmrc`).

## Loading it into Figma

1. Run a build first — `manifest.json` points at `dist/`, which is gitignored.
2. In Figma, right-click the canvas → **Plugins** → **Manage Plugins**.
3. Import this project's `manifest.json`.

In watch mode, sandbox changes (`src/code.ts`) hot-reload. UI changes (`src/ui.tsx`) need the
plugin re-run.

### You need a Picsart API key, and it is not optional

`src/ui.tsx` gates every tab behind `apiKey &&`, so **until a key is stored, no panel renders
at all** — the plugin shows only its intro screen. This is the step that decides whether the
first five minutes with this repo work, and it was documented nowhere.

1. Get a key from [console.picsart.io](https://console.picsart.io) → **Apps**. It is a paid
   product; the free allowance is small and **every button in this plugin spends credits**.
2. Launch the plugin, paste the key into the intro screen, submit.
3. It is stored in `figma.clientStorage` under `picsart_api_key`, per user and per plugin — not
   per file. Clear it from the **Set API Key** tab.

**Everything that needs a key also costs money to exercise.** That is why
`npm run test:run` — 189 tests, under two seconds, no key — is the loop to work in, and why
the tests stub at the `@api` and `@utils/placement` boundaries rather than reaching the network.
Manual QA against the real endpoints is the last step, not the first.

## The one thing to understand first

A Figma plugin is **two separate JavaScript environments** that share no memory and communicate
only by `postMessage`:

| | Sandbox | UI iframe |
|---|---|---|
| Entry | `src/code.ts` → `dist/code.js` | `src/ui.tsx` → `dist/ui.html` |
| Has | `figma.*`, canvas nodes, `clientStorage` | full `fetch`, DOM, React |
| Lacks | unrestricted network access | **`figma` does not exist** |

So: every network call to Picsart happens in the UI, and every canvas mutation happens in the
sandbox. Sandbox-side code lives at the repo root (`constants/`, `controllers/`, `routes/`,
`services/`); UI code lives in `src/`. An eslint rule blocks `figma` under `src/**` (except
`src/code.ts`, the sandbox entry point) because reaching for it there is a runtime crash that
TypeScript will not catch.

`ui.html` must ship as a single self-contained file — `InlineChunkHtmlPlugin` inlines the UI's
JS into it. Don't add UI assets that need to load as separate files at runtime.

## Project layout

```
constants/          message types, tabs, commands, endpoints, copy   (shared)
controllers/        one per menu command; all boot via openPanel.ts  (sandbox)
routes/             figma.command -> controller                      (sandbox)
services/           ImageProcessor, UiBridge, MessageListeners        (sandbox)
src/api/            every Picsart API call + sendMessageToSandBox     (UI)
src/components/     React components, incl. ui/ shared primitives    (UI)
src/context/        Balance, Active, Selection                        (UI)
src/hooks/          useSelectedImage — the single selection check     (UI)
src/types/          enums + messages.ts (postMessage payload types)  (shared)
```

## Adding a command

1. Menu entry (`name` + `command`) in `manifest.json`.
2. `COMMAND_*` constant in `constants/commands.ts`.
3. Tab in `TabType` (`src/types/enums.ts`); `constants/tabs.ts` derives `TAB_*` from it.
4. `controllers/XxxController.ts` — call `setMessageListeners(figma)` then `openPanel({ tab, height })`. Export it from `controllers/index.ts`.
5. Map command → controller in `constants/routes.ts`.
6. Component under `src/components/`, plus a `TabType` case in `renderPage()` in `src/ui.tsx`.

## Two rules worth stating up front

**Every API call costs the user money.** Guard each one against firing twice. A `useEffect`
dependency array alone is not enough — a fresh `Uint8Array` is a new identity — and a
`loading` flag must be in the submit guard, because the loading overlay blocks the mouse but
not the keyboard.

**Never `figma.ui.postMessage` directly.** Use `postToUi()` from `services/UiBridge.ts`. It
queues until the UI reports it has mounted, which replaced a `setTimeout(..., 400)` guess in
every controller. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) → "The seam".

## Tests

Vitest. Tests live in `__tests__/` beside the code, default environment `node`; a component
test opts into jsdom with `// @vitest-environment jsdom` on line 1. `vitest.config.ts` derives
its path aliases from `tsconfig.json`, so adding an alias needs no change there.

Note that `createImageBitmap` does not exist in jsdom and `Image.onload` never fires for blob
URLs, so anything needing a real image decode is manual QA, not a unit test.

## Contributing

Branch per feature, Google TypeScript Style Guide, two approvals from code owners.
`CONTRIBUTING.md` is generic Picsart-SDK boilerplate and does **not** describe this repo —
it references `/tests/`, `/scripts/`, Python and Java, none of which exist here.

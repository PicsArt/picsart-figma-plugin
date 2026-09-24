# Releasing

How a release of **AI Image Generator & Editor by Picsart** is cut and published.

Figma owns distribution: there is no npm publish, and **no CI** — nothing runs the gate
except whoever remembers to. A release is a production build on a reviewer's own machine,
published through the Figma desktop app. `dist/` is gitignored, so **the build artefact
never lands in git** — what you publish is whatever `dist/` holds at the moment you press
Publish. Build deliberately, immediately before publishing.

## Versioning

Figma assigns the user-visible number (Version 16, Version 17, …) when you
publish; you cannot choose it. `manifest.json` has no version field — its
`"api": "1.0.0"` is the Figma plugin API level, not the app version.

Figma's counter increments by one per published version, so the next number is
knowable before you publish: check the Community page for the current one and add
one. Confirm it matches after publishing.

So the release identity lives in two places, and both must agree:

1. `package.json` `version` — `0.<figma-version>.0`, so Version 17 is `0.17.0`.
   Bumped by hand, in `package-lock.json` too (root and `packages[""]`).
   Version 16 shipped as `0.1.0`, before this convention.
2. A git tag `vN` matching Figma's number, on the released commit.

There is no changelog. The tag range is the record: `git log <prev-tag>..<tag>`.

## 1. Pick the commit

Release from `main`. Confirm the working tree is clean and level with origin:

```bash
git switch main && git pull --ff-only
git status --porcelain        # must be empty
git log --oneline -1
```

Determine what is actually in the release. The previous release's tag is the
boundary; if the tag is missing, the boundary is the last commit authored before
the previous release's publish date on the Community page.

```bash
git log --oneline <previous-tag>..main
git diff --stat <previous-tag>..main
```

## 2. Pre-flight gate

`npm run gate` runs all six stages, and none subsumes another — `lint` skips
`webpack.config.js`, `tsconfig.json`'s `include` skips the sandbox dirs, only
`test:run` catches a behavioural regression, only `build` catches a comment ending
in the word "import", only `check:bundle` sees UI-only code in the sandbox bundle
(and it has to read the DEV build, because production tree-shaking removes the
violation), and only `build:prod` executes the production config.

```bash
nvm use                # .nvmrc → 20
npm ci
npm run gate           # must exit 0
```

`build:prod` should finish with **zero** warnings. This file used to say "expect
exactly 3 webpack warnings, all asset-size advisories" — there are none, so a
releaser was trained to wave through three findings that would now be real. Treat
any warning as a real finding and investigate before shipping.

Confirm the build output exists and is fresh:

```bash
ls -la dist/           # code.js, ui.html, ui.js
```

`manifest.json` points at `dist/code.js` and `dist/ui.html`. If `dist/` is stale,
Figma silently loads the old build and reports no error.

## 3. Check the manifest

If the release touched any endpoint URL, verify every host it now calls is in
`manifest.json` `networkAccess.allowedDomains`. A missing host fails at runtime
only, on the user's machine, with no build-time signal.

```bash
grep -rn 'https://' constants/url.ts constants/auth.ts
```

`manifest.json` is JSON and cannot carry a comment, so the reason each auth host is
declared lives here and in `constants/auth.ts`:

- **`https://auth.picsart.com`** — the authorization server. `oauth2/authorize`,
  `oauth2/token`, `oauth2/register` and `connect/logout` are all under `/api` on it.
- **`devAllowedDomains`** applies to a locally imported manifest only and costs nothing
  at review: `http://localhost:8080` is the auth spike harness in `spike/auth/`
  (gitignored), and `https://api.picsart.com` is the gateway used as a known-good
  control when a 401 has to be attributed to the resource rather than to the credential.

Neither `https://api.picsart.com` nor `https://picsart.com` belongs in
`allowedDomains`: the gateway hosts nothing the plugin calls (`404` for all three
`figma/*` routes) and the `mini-apps-portal` flow is not used.

**Domain changes are a store-review gate**, so a release that adds one has a slower
cycle than one that does not — which is why these two landed ahead of the account-auth
code that now uses them.

**One domain is deliberately still absent, and it is the next one to think about.** The
sign-in rendezvous is `AUTH_RENDEZVOUS.mode = "paste"` (`constants/auth.ts`): the user
copies the redirected address out of their browser and pastes it into the panel, so the
plugin never fetches the redirect host and never navigates the iframe to it — which is
exactly why no entry is needed for it today. Switching the mode to `"relay"`, so the
iframe polls a host we control instead of asking for a paste, **adds that origin to
`allowedDomains` and therefore costs a review cycle**. It also needs a newly registered
`client_id`, because a redirect URI is fixed at registration and this authorization
server publishes no RFC 7592 management. If both are wanted, they belong in the same
submission. `services/rendezvous.ts` lists the four things that change and nothing else.

## 4. Bump the version

Set `package.json` `version` to `0.<figma-version>.0`, and the same value in
`package-lock.json` — both the root `version` and `packages[""].version`, or the
lockfile is left describing the previous release. Verify:

```bash
node -e "const p=require('./package.json'),l=require('./package-lock.json');\
console.log(p.version, l.version, l.packages[''].version)"
```

## 5. Publish

1. Figma desktop app → Plugins → the plugin → **Publish new version**.
2. Write the "What's new" copy straight into the field. Keep it user-facing: lead
   with what people can now do, state plainly any breakage they had been hitting,
   and leave out internals — endpoint migrations, refactors, dependency bumps and
   the known issues above do not belong in front of users.
3. Refresh screenshots only if the UI changed visibly.
4. Submit. Figma reviews before the update goes live.
5. Note the version number Figma assigned.

## 6. Tag

The tag records the commit the build came from, so it can be created as soon as
the release commit exists — the version number is predictable (see Versioning).

```bash
git tag -a v17 -m "Version 17 — internal 0.17.0"
git push origin v17
```

After publishing, verify Figma assigned the number you assumed. If it differs,
retag (`git tag -d vN && git tag -a v<actual> …`) and correct `package.json`
before pushing.

## Packaging a zip

Publishing goes through the Figma desktop app, which reads `manifest.json` out of
your working copy — the publish path never needs a zip. A zip is for handing the
*exact* build to someone else: a second reviewer running the QA pass, or an
archive of what actually shipped, which matters because `dist/` is gitignored and
the next build overwrites it.

Build first. The zip captures whatever `dist/` holds at that moment and gives no
warning if it is stale:

```bash
npm run build:prod
zip -r picsart-figma-plugin-v17.zip manifest.json dist/code.js dist/ui.html
```

Three files, and the `dist/` prefix is load-bearing: `manifest.json` points at
`dist/code.js` and `dist/ui.html`, so the archive has to reproduce that layout
with `manifest.json` at the root. Running `zip` from inside `dist/`, or flattening
the paths, produces an archive Figma cannot import.

`dist/ui.js` and `dist/ui.js.LICENSE.txt` are deliberately excluded.
`InlineChunkHtmlPlugin` inlines the UI bundle into `ui.html`, which ends up with
no external `<script src>` at all, so `ui.js` is a by-product nothing loads —
shipping it would roughly double the archive for no effect. The corollary is the
standing rule that the UI must not gain assets it loads as separate files at
runtime; if one ever appears, this file list is wrong.

Verify the contents, and that the UI really is self-contained:

```bash
unzip -l picsart-figma-plugin-v17.zip        # exactly the 3 paths above
unzip -p picsart-figma-plugin-v17.zip dist/ui.html | grep -c 'script src'   # 0
```

To confirm it loads, extract the archive somewhere outside the repo and import
*that* copy: Figma → right-click canvas → Plugins → Manage plugins → import the
extracted `manifest.json`. Figma has no "import zip", and importing the manifest
from the repo proves nothing — it would be reading your working copy rather than
the archive.

Name the archive after the release (`-v17`) so it can be traced back to a tag.

## Rollback

There is no revert button. Figma serves the latest approved version, so
recovering means publishing again:

1. `git switch --detach <last-good-tag>`
2. `npm ci && npm run build:prod`
3. Publish that build as a new version.
4. Land the actual fix on `main` afterwards.

Because a rollback is itself a reviewed release, it is not fast. Weight the QA
pass accordingly.

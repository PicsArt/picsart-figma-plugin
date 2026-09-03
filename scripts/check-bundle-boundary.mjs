import { readFileSync } from "node:fs";

const BUNDLE = "dist/code.js";

const FORBIDDEN = [
  { path: "src/api/index.ts", why: "holds sendMessageToSandBox, which dereferences `parent`" },
  { path: "src/ui.tsx", why: "the React entry point; renders into a DOM the sandbox has none of" },
  { path: "src/components/", why: "React components" },
  { path: "src/context/", why: "React contexts" },
  { path: "src/hooks/", why: "React hooks, and they listen on `window`" },
  { path: "src/utils/placement.ts", why: "posts through `parent` and listens on `window`" },
  { path: "src/utils/imageBinary.ts", why: "needs createImageBitmap and a canvas" },
  { path: "src/ui_constants/", why: "UI copy; nothing sandbox-side renders text" },
];

const FORBIDDEN_TEXT = [
  { text: "parent.postMessage", why: "UI-side transport; the sandbox has no `parent`" },
  {
    text: "x-picsart-credit-available",
    why: "read via response.headers.get, which the sandbox FetchResponse lacks",
  },
];

let source;
try {
  source = readFileSync(BUNDLE, "utf8");
} catch {
  console.error(
    `check-bundle-boundary: ${BUNDLE} is missing. Run \`npm run build\` first — this ` +
      `check is about the DEVELOPMENT bundle specifically.`
  );
  process.exit(1);
}

const modules = new Set(
  Array.from(source.matchAll(/"\.\/([a-zA-Z0-9_/.@-]+\.tsx?)"/g), (m) => m[1])
);

if (modules.size === 0) {
  console.error(
    "check-bundle-boundary: found no module paths in the bundle, so this check " +
      "proved nothing. The dev build's module registry format changed — fix the " +
      "pattern rather than deleting the check."
  );
  process.exit(1);
}

const failures = [];

for (const { path, why } of FORBIDDEN) {
  const hits = [...modules].filter((m) => m === path || m.startsWith(path));
  for (const hit of hits) failures.push(`  ${hit}\n      ${why}`);
}

for (const { text, why } of FORBIDDEN_TEXT) {
  if (source.includes(text)) failures.push(`  contains "${text}"\n      ${why}`);
}

if (failures.length > 0) {
  console.error(
    `check-bundle-boundary: ${BUNDLE} carries UI-only code.\n\n` +
      failures.join("\n") +
      `\n\nThe sandbox bundle should hold constants/, controllers/, routes/, services/,\n` +
      `src/code.ts, and the three narrow API modules getBalance.ts, customFetch.ts and\n` +
      `apiError.ts. Import the narrow module, not the @api/index barrel.\n`
  );
  process.exit(1);
}

console.log(
  `check-bundle-boundary: ok — ${modules.size} modules in ${BUNDLE}, none UI-only.`
);

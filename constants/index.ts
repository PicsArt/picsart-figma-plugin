export * from './auth';
export * from './commands';
export * from './env';
export * from './errorMessages';
export * from './generateImageOptions';
export * from './removeBgOptions';
export * from './upscaleOptions';
export * from './messages';
export * from './promptExamples';
// './routes' is deliberately NOT re-exported here. It imports @controllers/index,
// which pulls every controller — and therefore every figma.* and clientStorage
// call — into anything that touches this barrel. Since 11 UI modules pull in
// @constants/index, that shipped the whole sandbox inside the UI iframe
// bundle, where figma does not exist. routes/CommandRouter.ts is the only
// consumer and imports '@constants/routes' directly.
//
// Note the wording: no comment line here may END with the word "import".
// Figma evaluates dist/code.js through an SES realm whose import-expression
// guard matches `import` followed by whitespace and then `(`, `//` or `/*`,
// so `import` at end-of-line plus the next `//` line reads as a dynamic
// import and the whole plugin is rejected before it runs. See the
// RejectImportExpression check in webpack.config.js.
export * from './types';
export * from './url';
export * from './tabs'; 
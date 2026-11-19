# Build Tooling Cheat Sheet (this project)

> Companion to [MITHRIL_CHEATSHEET.md](MITHRIL_CHEATSHEET.md). Same format: compact first, **💡 notes** for the "why".
> Everything here is about **how your `src/` turns into files a browser can run.**

---

## 0. Big picture

```
src/main.tsx ──┐
               │  webpack follows every import, starting at the entry
               ▼
   .tsx  ──esbuild-loader──▶ JS          (types stripped, <div> → m("div"))
   .scss ──sass → css-loader → MiniCssExtractPlugin──▶ main.css
   .svg  ──asset/source──▶ JS string
   .woff2/.png/... ──asset/resource──▶ copied file + URL
               │
               ▼
   dist/  index.html + main.[hash].js + main.[hash].css + chunks + assets
```

- 💡 Browsers can't run `.tsx`, `.scss`, or `import "./x.svg"`. Webpack **bundles** everything into plain JS/CSS/files the browser understands.
- 💡 Webpack itself only understands JS. Everything else goes through a **loader** (or a built-in asset type) that turns it into a JS module first.

---

## 1. Who does what

| Tool | Job | Where |
|---|---|---|
| **npm** | Installs packages into `node_modules/`, runs scripts | [package.json](package.json) |
| **webpack** | The bundler: builds the dependency graph and writes the output | [webpack.config.cjs](webpack.config.cjs) |
| **webpack-cli** | The `webpack` command | scripts |
| **webpack-dev-server** | Local server on :3000 that rebuilds in memory on save | `devServer` |
| **esbuild** + **esbuild-loader** | Compiles TS/TSX → JS (very fast). Also minifies JS + CSS in production. | `rules`, `optimization` |
| **typescript (`tsc`)** | **Only typechecks.** Produces no output (`noEmit`). | [tsconfig.json](tsconfig.json), `npm run typecheck` |
| **sass** + **sass-loader** | SCSS → CSS | `rules` |
| **css-loader** | Resolves `@import`/`url()` in CSS into webpack dependencies | `rules` |
| **mini-css-extract-plugin** | Pulls the CSS out of the JS into a real `.css` file | `rules` + `plugins` |
| **html-webpack-plugin** | Generates `dist/index.html` from [index.html](index.html) and injects the `<script>`/`<link>` tags | `plugins` |

- 💡 **Two separate TypeScript tools**: esbuild *compiles* (strips types without checking them), tsc *checks* (doesn't output anything). That's why **the app builds and runs even with type errors** → run `npm run typecheck` (or watch the editor's errors).

---

## 2. package.json

```jsonc
"type": "module",                 // .js files are ESM (import/export) by default
"scripts": {
  "start":     "webpack serve ... --mode=development",   // dev server
  "build":     "webpack ...       --mode=production",    // → dist/
  "typecheck": "tsc --noEmit"
},
"sideEffects": ["*.css", "*.scss"],
"dependencies":    { mithril, mithril-tsx-component },   // ends up in the browser bundle
"devDependencies": { webpack, typescript, sass, ... },   // build-time only
"browserslist": ["last 2 Chrome versions", ...]
```

| Thing | Notes |
|---|---|
| `npm install` | Installs exact versions from `package-lock.json` (commit the lock file; never `node_modules`). |
| `npm start` / `npm run build` | `start` is special and doesn't need `run`. Other scripts do. |
| `npx <tool>` | Runs a tool from `node_modules/.bin` (e.g. `npx tsc`). |
| `^2.3.8` | Any `2.x.y` ≥ 2.3.8. The lock file pins the real version. |
| `"type": "module"` | This is why the config is **`.cjs`**: it uses `require`/`module.exports` (CommonJS), so it needs the `.cjs` extension to opt out. |
| `sideEffects` | Tells webpack that only CSS files "do something" when imported. JS files with unused exports can be dropped (**tree shaking**), and `import "./main.scss"` won't be. |
| `browserslist` | Target browsers. Webpack 5 uses it for its own runtime code. **esbuild ignores it** and uses `target: "es2020"` instead. |

- 💡 dependencies vs devDependencies doesn't affect what goes in the bundle (webpack bundles whatever you `import`). It's mostly documentation and matters for server deploys.

---

## 3. webpack.config.cjs walkthrough

```js
module.exports = (env, argv) => {                 // function form → can read --mode
  const isProduction = argv.mode === "production"
  return {
    entry: "./src/main.tsx",                       // start of the dependency graph
    devtool: isProduction ? false : "eval-cheap-module-source-map",
    cache: { type: "filesystem" },                 // faster rebuilds (node_modules/.cache/webpack)
    output: {
      filename:      isProduction ? "[name].[contenthash].js" : "[name].js",
      chunkFilename: isProduction ? "[name].[contenthash].js" : "[name].js",
      path: path.join(__dirname, "dist"),
      publicPath: "/",                             // chunks are loaded from /xxx.js (absolute)
      clean: true,                                 // empty dist/ before each build
    },
    module: { rules: [ ... ] },                    // §4
    resolve: {
      alias: { "@root": path.resolve(__dirname, "src") },
      extensions: [".tsx", ".ts", ".js"],          // import "./x" finds x.tsx/x.ts/x.js
    },
    optimization: { minimizer: [new EsbuildPlugin({ target: "es2020", css: true })] },
    performance: { hints: false },                 // silence "bundle too big" warnings
    plugins: [ MiniCssExtractPlugin, HtmlWebpackPlugin ],
    devServer: { port: 3000, open: "/", hot: false, historyApiFallback: true },
  }
}
```

| Option | 💡 Why |
|---|---|
| `devtool` (source maps) | In dev, DevTools shows your real `.tsx` lines instead of the bundled code. Turned off in prod so your source isn't shipped. |
| `[contenthash]` | The file name changes **only when its content changes** → browsers can cache files forever and still get updates. Not used in dev because there's no point. |
| `publicPath: "/"` | Without it, on `/test/123` the browser would try to load chunks from `/test/xxx.js` → 404. Goes with `<base href="/">` in [index.html](index.html). |
| `alias @root` | `import "@root/components/link"` instead of `../../components/link`. **Also declared in tsconfig `paths`**: webpack and TS each need to know about it. |
| `EsbuildPlugin` minimizer | Replaces webpack's default minifier (Terser) with esbuild: same idea, much faster. |
| `hot: false` | No HMR (hot module replacement). Saving a file → **full page reload**, so component state resets. |
| `historyApiFallback` | Serves `index.html` for unknown URLs. Needed because `m.route.prefix = ""` gives real paths like `/test/1`. **Your production host needs the same rule.** |
| `proxy` (commented out) | Forwards `/api/*` from :3000 to a backend → no CORS problems in dev. |

---

## 4. Rules: what `import x from "file"` gives you

```js
rules: [
  { test: /\.svg$/,  type: "asset/source" },
  { test: /\.(jpe?g|png|gif|ico|woff2?|ttf|eot)$/, type: "asset/resource" },
  { test: /\.tsx?$/, loader: "esbuild-loader", options: { loader: "tsx", target: "es2020" } },
  { test: /\.s?css$/, use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"] },
]
```

| File | Rule | `import x from "..."` → `x` is |
|---|---|---|
| `.svg` | `asset/source` | The **file contents** as a string (`"<svg ...>"`) → used with `m.trust(x)` |
| `.png`, `.woff2`, … | `asset/resource` | A **URL** (`"/2d51...woff2"`). File copied to `dist/` with a hashed name. |
| `.ts`, `.tsx` | `esbuild-loader` | Normal JS module |
| `.scss`, `.css` | sass → css → extract | Nothing useful. The import exists only so the CSS gets bundled into `main.css`. |

- 💡 `use: [a, b, c]` runs **right to left**: `sass-loader` (SCSS→CSS) → `css-loader` (resolve `url()`/imports) → extract to a file.
- 💡 Other built-in types: `asset/inline` (embed as a `data:` URL) and `asset` (inline if small, otherwise a file).
- 💡 TypeScript doesn't know about webpack's rules, so [src/types.d.ts](src/types.d.ts) declares `"*.svg"` etc. as `string`. Add a new file type? Add a rule **and** a declaration.
- 💡 `url("@root/assets/fonts/...")` in [font.scss](src/style/font.scss) works because css-loader hands `url()` to webpack → the alias resolves → `asset/resource` copies the font.

---

## 5. Static vs dynamic import → chunks

```ts
import { Link } from "@root/components/link"       // STATIC: in main.js, loaded at startup
import("./pages/home").then(x => x.Page)           // DYNAMIC: separate chunk, downloaded when called
import(`@root/assets/${folder}/${name}.svg`)       // DYNAMIC + variable: one chunk PER matching file
```

Your actual production build:

```
main.[hash].js     29 KB   ← Mithril (~most of it) + main.tsx + layout + components
main.[hash].css    5.7 KB  ← all SCSS
776.[hash].js      0.7 KB  ← pages/home.tsx  (route chunk)
225.[hash].js      0.7 KB  ← pages/test.tsx  (route chunk)
500.[hash].js      0.4 KB  ← icons/chevron_up.svg
623.[hash].js      0.3 KB  ← icons/check.svg
*.woff2            4 fonts
index.html, favicon.ico
```

- 💡 **Code splitting** = shipping less JS up front. Worth it for big pages. For 0.3 KB icons the extra request costs more than it saves (see the Svg.tsx discussion).
- 💡 With a variable path, webpack can't know which file you mean at build time, so it creates a chunk for **every** file the pattern could match.
- 💡 Chunks get numeric ids. To get readable names: `import(/* webpackChunkName: "home" */ "./pages/home")`.
- 💡 Webpack caches loaded modules: calling `import()` for the same module twice doesn't download it again, but it always returns a Promise (async).

---

## 6. tsconfig.json

| Option | 💡 Why |
|---|---|
| `"jsx": "react"` + `"jsxFactory": "m"` | `<div a={1}>x</div>` compiles to `m("div", {a:1}, "x")`. → **every `.tsx` file needs `import m from "mithril"`**, even if `m` looks unused. esbuild-loader reads these settings from tsconfig too. |
| *(no `jsxFragmentFactory`)* | So `<>…</>` doesn't work → use `<Frag>` |
| `"noEmit": true` | tsc only checks; esbuild produces the output |
| `"moduleResolution": "bundler"` | Resolve imports the way webpack/Vite do (no `.js` extensions required, etc.) |
| `"verbatimModuleSyntax": true` | Type-only imports must use `import type { X }`. esbuild compiles **one file at a time** and can't tell whether an import is a type, so you have to say so explicitly. |
| `"strict": true` | Null checks etc. Hence the `!` in `getElementById("app")!`. |
| `"paths": { "@root/*": [...] }` | TS side of the webpack alias |
| `"target": "ES2020"`, `"lib"` | Which JS syntax/APIs TS assumes exist (`DOM` = `document`, `window`, …) |
| `"skipLibCheck": true` | Don't typecheck `.d.ts` files in `node_modules` (faster, fewer third-party errors) |

---

## 7. Styles (SCSS)

```
main.tsx:  import "./main.scss"
main.scss: @use "./style/reset.scss"; @use "./style/font.scss"; ...
```

- 💡 There's **one global stylesheet**: no CSS modules or scoped styles. Class names in TSX (`className="stack"`) just match global CSS classes.
- 💡 `@use` is the modern Sass import. Each file is included once; variables are namespaced (`@use "x"` → `x.$var`).
- 💡 There are two kinds of variables in [style/variables/](src/style/variables/): **Sass `$vars`** (compile-time, e.g. breakpoints `$md: 768px`) and **CSS `--vars`** (runtime, e.g. `var(--white)`, can change in the browser).
- 💡 Built to `main.[hash].css`, linked in `<head>` by HtmlWebpackPlugin.

---

## 8. Dev vs production

| | `npm start` (development) | `npm run build` (production) |
|---|---|---|
| Output | In memory, served on :3000 | Files in `dist/` |
| Minified | No | Yes (esbuild) |
| File names | `main.js` | `main.[contenthash].js` |
| Source maps | Yes | No |
| On save | Rebuild + full page reload | n/a |
| Deploy | — | Upload `dist/` to any static host + fallback to `index.html` |

---

## 9. index.html

```html
<base href="/">          <!-- relative URLs resolve from root, even on /test/123 -->
<div id="app"></div>     <!-- m.route mounts here -->
```

HtmlWebpackPlugin injects `<script defer src="/main.[hash].js">`, the CSS `<link>`, and the favicon. **Don't add those tags by hand.**

---

## 10. Gotchas checklist

- [ ] Builds fine but the editor shows red → esbuild doesn't typecheck; run `npm run typecheck`.
- [ ] `m is not defined` / JSX errors → missing `import m from "mithril"` in a `.tsx` file.
- [ ] `import { SomeType }` error → use `import type { SomeType }` (verbatimModuleSyntax).
- [ ] `Cannot find module '*.xyz'` in TS → add a declaration to [types.d.ts](src/types.d.ts) (and a webpack rule).
- [ ] New alias works in webpack but not TS (or vice versa) → update **both** `resolve.alias` and tsconfig `paths`.
- [ ] Refresh on `/some/route` gives 404 in production → server needs an SPA fallback to `index.html`.
- [ ] Changed `webpack.config.cjs` → restart `npm start` (config isn't hot-reloaded).
- [ ] Weird stale build → delete `node_modules/.cache` (filesystem cache).

---

## 11. Try it yourself

1. `npm run build` → open `dist/` and match the files to §5.
2. `npm start` → DevTools **Network** tab → visit `/test/123` → watch the `test` chunk download only then.
3. DevTools **Sources** → find your `.tsx` files (source maps).
4. Add `/* webpackChunkName: "home" */` to the import in [main.tsx](src/main.tsx), rebuild, and see the name appear.
5. Introduce a type error, then compare `npm start` (still works) with `npm run typecheck` (fails).

Docs: https://webpack.js.org/concepts/ · https://webpack.js.org/guides/code-splitting/ · https://esbuild.github.io/content-types/#typescript-caveats

# Frontend starter

Minimal standalone version of our frontend projects: Mithril + TSX + SCSS, bundled with webpack + esbuild.

## Quick start

Requires Node 20+.

```
npm install
npm start
```

Dev server runs on <http://localhost:3000/> (opens automatically).

Other scripts:

- `npm run build` - production build to `dist/`
- `npm run typecheck` - TypeScript check (esbuild does not type check)

## Structure

```
src/
  main.tsx          Entry + routes (m.route, prefix "")
  main.scss         Global styles imports + layout helpers
  pages/            One file per route, lazy loaded (home, test) + Layout
  components/       Shared components (Link, Frag, Svg)
  utils/            Helpers (empty)
  style/            Reset, fonts, CSS variables, typography, buttons
  assets/           Fonts, SVG icons, favicon
```

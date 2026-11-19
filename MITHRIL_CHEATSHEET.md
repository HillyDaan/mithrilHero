# Mithril.js Cheat Sheet (v2.x, TSX + class components)

> Format: compact snippet/table first, then **💡 notes** with the "why". Delete the notes once it clicks.
> Examples follow this template's style: `MithrilTsxComponent` classes + TSX (`jsxFactory: "m"`).

---

## 0. Mental model (read once)

```
state changes  →  redraw  →  view() runs again  →  new vnode tree  →  diff vs old tree  →  patch real DOM
```

- 💡 Mithril is a **virtual DOM** lib. Your `view()` just *describes* the UI; Mithril works out what to change in the real DOM.
- 💡 There is **no `setState`**. State is plain JS (class fields, variables). Mithril just re-runs `view()` on redraw.
- 💡 Redraws happen **automatically** after: Mithril event handlers, `m.request`, route changes. Everything else (setTimeout, `fetch`, `await` of non-Mithril stuff, websockets) → call `m.redraw()` yourself. **#1 beginner bug.**

---

## 1. Hyperscript `m()` & TSX

```ts
m(selector, attrs?, ...children)

m("div")                                  // <div></div>
m("div.card#main.big", "hi")              // <div id="main" class="card big">hi</div>
m("input[type=text][placeholder=Name]")   // attrs in selector
m("a", { href: "/x", class: "btn" }, "Go")
m("ul", items.map(i => m("li", { key: i.id }, i.name)))
m(MyComponent, { foo: 1 }, "child")       // render a component
```

```tsx
// Same thing in TSX (tsconfig: "jsx": "react", "jsxFactory": "m")
<div className="card" id="main">hi</div>
<MyComponent foo={1}>child</MyComponent>
```

| Thing | Notes |
|---|---|
| `class` / `className` | Both work. Selector classes + `class` attr are merged. |
| `style` | String `"color:red"` or object `{ color: "red", fontSize: "12px" }` |
| `on<event>` | `onclick`, `oninput`, `onsubmit`… lowercase, like DOM. Auto-redraws after. |
| `key` | Identity for list items (see §6). Not passed to the DOM. |
| lifecycle hooks | `oncreate`, `onremove`, … also usable on plain elements (§4). |
| boolean attrs | `disabled={true}` / `checked={x}` |
| `value` | Set `value` + `oninput` for controlled inputs. |

- 💡 TSX `<></>` fragments **don't work** here (no `jsxFragmentFactory` set) → that's why the template has [Frag](src/components/frag.tsx). Alternatives: return an array, or `m.fragment({}, children)`, or `m("[", ...)`.
- 💡 Children can be: string, number, vnode, array, `null`/`undefined`/`false`/`true` (rendered as nothing → handy for `cond && <X/>`).

---

## 2. VNodes

A **vnode** = plain JS object describing one node. You get one passed into every component method (`v` in the template).

| Property | Meaning |
|---|---|
| `v.tag` | `"div"`, a component, `"#"` (text), `"["` (fragment), `"<"` (trusted HTML) |
| `v.attrs` | **Props** passed in by the parent. Treat as read-only. |
| `v.children` | Children passed in by the parent (what's between the tags). |
| `v.key` | The key, if any. |
| `v.state` | Component instance state (for class components = `this`). |
| `v.dom` | Real DOM element. **Only available from `oncreate`/`onupdate` on.** |
| `v.domSize` | # of DOM nodes when vnode is a fragment/multi-root. |
| `v.text` | Text content (text vnodes). |

TS types (from `@types/mithril`):

| Type | Use |
|---|---|
| `m.Vnode<Attrs, State>` | Param of `view`, `oninit`, `onbeforeupdate`… |
| `m.VnodeDOM<Attrs, State>` | Param of `oncreate`, `onupdate`, `onbeforeremove`, `onremove` (has `.dom`) |
| `m.Children` | Anything renderable (vnode, string, array, null…) |
| `m.Component<A>` / `m.ClassComponent<A>` / `m.FactoryComponent<A>` | Component typings |

- 💡 Vnodes are **recreated every redraw**. Don't store them and reuse them later, don't mutate them.
- 💡 `v.attrs` = React "props". `this.x` (class fields) = React "state".

---

## 3. Components

Anything with a `view` method. Three styles:

```tsx
// 1) Class (this template) — MithrilTsxComponent gives typed attrs in TSX
interface ICounter { start: number }
export class Counter extends MithrilTsxComponent<ICounter> {
  count = 0
  oninit(v: m.Vnode<ICounter>) { this.count = v.attrs.start }
  view(v: m.Vnode<ICounter>) {
    return <button onclick={() => this.count++}>{this.count}</button>
  }
}
// usage: <Counter start={5} />

// 2) Closure (very common in Mithril docs)
function Counter(initial: m.Vnode<ICounter>) {
  let count = initial.attrs.start
  return { view: () => m("button", { onclick: () => count++ }, count) }
}

// 3) POJO (object) — stateless or shared state
const Hello = { view: (v: m.Vnode<{ name: string }>) => m("p", `Hi ${v.attrs.name}`) }
```

- 💡 `MithrilTsxComponent` (npm `mithril-tsx-component`) is basically just a typed base class so TS knows `<Counter start={5}/>` is valid. Nothing magic.
- 💡 One component instance lives as long as its spot in the tree is the same component (and same key). Class fields persist across redraws.
- 💡 Passing children: `<Layout>{stuff}</Layout>` → `v.children` inside Layout ([layout.tsx](src/pages/layout.tsx)).

---

## 4. Lifecycle hooks

| Hook | When | Args | Return |
|---|---|---|---|
| `oninit` | Before first render. **No DOM yet.** | `(vnode)` | — |
| `oncreate` | After DOM inserted. | `(vnodeDOM)` | — |
| `onbeforeupdate` | Before re-diff (not on first render). | `(vnode, old)` | `false` = skip diffing this subtree |
| `onupdate` | After DOM updated. | `(vnodeDOM)` | — |
| `onbeforeremove` | Before DOM removed. | `(vnodeDOM)` | `Promise` = wait for it (exit animations) |
| `onremove` | DOM removed. Cleanup. | `(vnodeDOM)` | — |

```tsx
oninit(v)    { loadData() }                         // fetch data, init state
oncreate(v)  { this.chart = new Chart(v.dom) }      // 3rd-party libs, measure, focus
onremove(v)  { this.chart.destroy(); clearInterval(this.t) }  // ALWAYS clean up
onbeforeremove(v) {
  v.dom.classList.add("fade-out")
  return new Promise(r => v.dom.addEventListener("animationend", r))
}

// Also works on plain elements:
<input oncreate={(v) => (v.dom as HTMLInputElement).focus()} />
```

- 💡 Order: `oninit → view → oncreate` (first time), then `onbeforeupdate → view → onupdate` (each redraw).
- 💡 `oninit` runs **once**. If attrs change later (e.g. route `/test/1` → `/test/2` reusing the same component) it does NOT re-run → react to changes in `onbeforeupdate(v, old)` (see [Svg.tsx](src/components/Svg.tsx) comparing `v.attrs.name !== o.attrs.name`) or force a remount with a `key`.
- 💡 Don't call `m.redraw()` inside `onupdate` unconditionally → infinite loop.

---

## 5. Events & redraw

```tsx
<button onclick={(e: MouseEvent) => this.open = true}>Open</button>
<input value={this.name} oninput={(e: InputEvent) => this.name = (e.target as HTMLInputElement).value} />
<form onsubmit={(e: SubmitEvent) => { e.preventDefault(); this.save() }}>

// Skip the automatic redraw for one event (perf, e.g. mousemove):
onmousemove={(e: any) => { e.redraw = false; this.x = e.clientX }}
```

| API | What |
|---|---|
| `m.redraw()` | Schedule a redraw (async, batched to next animation frame). |
| `m.redraw.sync()` | Redraw **right now**, synchronously. Rarely needed. |
| `e.redraw = false` | Opt out of auto-redraw for this event. |

```ts
// Non-Mithril async → manual redraw
async load() {
  this.data = await fetch("/api").then(r => r.json())
  m.redraw()                        // <- needed! fetch isn't Mithril
}
setTimeout(() => { this.done = true; m.redraw() }, 1000)
```

- 💡 Calling `m.redraw()` too often is cheap (it's batched). Forgetting it = "my UI doesn't update" bug.

---

## 6. Keys

```tsx
<ul>{this.users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
```

- 💡 Keys tell Mithril "this is the *same* item" when a list is reordered/filtered, so DOM + component state follow the item instead of the position.
- 💡 Rule: in one array, **either all siblings have keys or none do** (Mithril throws otherwise).
- 💡 Use stable ids, **not** array indexes.
- 💡 Trick: changing a component's `key` forces destroy + recreate (fresh `oninit`): `<Profile key={id} id={id}/>`.

---

## 7. Mounting & rendering

| API | What |
|---|---|
| `m.mount(el, Component)` | Render component into `el` + enable auto-redraw. `m.mount(el, null)` unmounts. |
| `m.route(el, default, routes)` | Like `m.mount` but picks component by URL (§8). The template uses this. |
| `m.render(el, vnodes)` | Low-level one-off render. **No auto-redraw.** Rarely used directly. |

- 💡 Use **either** `m.route` **or** `m.mount` for the app root, not both on the same element.

---

## 8. Routing — `m.route`

```tsx
// main.tsx (this template)
m.route.prefix = ""                         // clean URLs: /test/1 instead of #!/test/1
m.route(document.getElementById("app")!, "/", {
  "/":            HomePage,                 // plain component
  "/test/:id":    TestPage,                 // :id → v.attrs.id
  "/files/:path...": FilesPage,             // variadic: matches "a/b/c"
  "/lazy": {                                // RouteResolver
    onmatch: (args, requestedPath, route) => import("./pages/home").then(x => x.Page),
    render: v => <Layout>{v}</Layout>,
  },
})
```

| API | What |
|---|---|
| `m.route.set(path, params?, options?)` | Navigate. `m.route.set("/test/:id", { id: 5 })`. Options: `{ replace: true, state, title }` |
| `m.route.get()` | Current path, e.g. `"/test/5?x=1"` |
| `m.route.param(key?)` | One route/query param, or all as object |
| `m.route.prefix` | `"#!"` (default), `"#"`, `"?"`, or `""` (History API) |
| `m.route.Link` | `<a>` that navigates without page reload (§9) |
| `m.route.SKIP` | Return from `onmatch` to fall through to the next matching route |

**Params** → arrive as `v.attrs` in the routed component (`v.attrs.id` in [test.tsx](src/pages/test.tsx)). Query string too: `/test/5?tab=a` → `v.attrs.tab === "a"`.

**RouteResolver** (object with `onmatch` and/or `render`):

| Part | Purpose |
|---|---|
| `onmatch(args, path, route)` | Runs on navigation. Return a component, or a **Promise** of one (code-splitting with `import()`), or redirect via `m.route.set(...)`. Good spot for auth guards. |
| `render(vnode)` | Wrap the resolved component, e.g. in a layout. `vnode` = the page component vnode. |

```ts
// Auth guard
"/admin": {
  onmatch: () => isLoggedIn() ? AdminPage : m.route.set("/login"),
}
```

- 💡 Template's pattern `onmatch: () => import(...)` = **lazy loading**: each page is its own JS chunk, downloaded on first visit.
- 💡 `render: v => <Layout>{v}</Layout>` keeps the *same* Layout instance between pages (it's diffed, not recreated) → header state survives navigation.
- 💡 `prefix = ""` needs the dev server / host to serve `index.html` for every path (history API fallback), otherwise refresh on `/test/1` gives 404.
- 💡 Same route, different params (`/test/1` → `/test/2`) **reuses** the page component → `oninit` doesn't run again. Use `onbeforeupdate`, or add a `key` route param / key in `render`.

---

## 9. Links — `m.route.Link`

```tsx
m(m.route.Link, { href: "/test/123" }, "Go")
m(m.route.Link, { href: "/test/:id", params: { id: 1 } }, "Go")
m(m.route.Link, { href: "/x", options: { replace: true } }, "Go")
m(m.route.Link, { href: "/x", selector: "button.btn" }, "Go")   // render as <button>
m(m.route.Link, { href: "/x", disabled: true }, "Nope")

// Template wrapper (scrolls to top + typed for TSX):
<Link className="btn-primary" href="/test/123">Demo</Link>
```

- 💡 A plain `<a href="/test/1">` does a **full page reload**. `m.route.Link` intercepts the click and calls `m.route.set` instead (while still a real `<a href>` so ctrl+click / new tab works).
- 💡 See [link.tsx](src/components/link.tsx): wraps `m.route.Link` and chains your own `onclick`.

---

## 10. HTTP — `m.request`

```ts
const user = await m.request<User>({
  method: "GET",                     // GET default. POST/PUT/PATCH/DELETE
  url: "/api/users/:id",             // :id interpolated from params
  params: { id: 5, q: "x" },         // leftovers → query string ?q=x
  body: { name: "Bob" },             // JSON-encoded automatically (non-GET)
  headers: { Authorization: "Bearer ..." },
  withCredentials: true,             // send cookies cross-origin
  responseType: "json",              // default; "text", "blob", "arraybuffer"
  timeout: 5000,
  background: false,                 // true = do NOT auto-redraw when done
  // advanced:
  // extract: (xhr) => ...           // custom response handling (status, headers)
  // deserialize: (text) => ...      // custom parse
  // config: (xhr) => xhr            // touch the raw XHR
})
```

```tsx
// Typical page pattern
export class Users extends MithrilTsxComponent<{}> {
  users: User[] = []
  loading = true
  error: string | null = null

  oninit() {
    m.request<User[]>({ url: "/api/users" })
      .then(u => this.users = u)
      .catch(e => this.error = e.message)   // e.code = HTTP status, e.response = body
      .finally(() => this.loading = false)
  }

  view() {
    if (this.loading) return <p>Loading…</p>
    if (this.error)   return <p>{this.error}</p>
    return <ul>{this.users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
  }
}
```

- 💡 Returns a normal **Promise** and **auto-redraws** on completion — that's the main reason to use it over `fetch`.
- 💡 Rejects on non-2xx status. Error object has `.code` (status) and `.response` (parsed body).
- 💡 Using `fetch` instead is fine, just remember `m.redraw()`.

---

## 11. Utilities

| API | What |
|---|---|
| `m.trust(html)` | Render a raw HTML string (no escaping). Used for SVGs in [Svg.tsx](src/components/Svg.tsx). ⚠️ XSS risk with user input. |
| `m.fragment(attrs, children)` | Group children without a wrapper element (can carry `key` + lifecycle). |
| `m.buildQueryString({a:1,b:[1,2]})` | `"a=1&b%5B0%5D=1&b%5B1%5D=2"` |
| `m.parseQueryString("?a=1")` | `{ a: "1" }` |
| `m.buildPathname("/u/:id", {id:1, x:2})` | `"/u/1?x=2"` |
| `m.parsePathname("/u/1?x=2")` | `{ path: "/u/1", params: { x: "2" } }` |
| `m.censor(attrs, ["extra"])` | Copy of attrs without lifecycle hooks/`key` (+ extras). Useful when spreading `v.attrs` onto a child. |
| `Stream` (`import Stream from "mithril/stream"`) | Optional reactive values: `const s = Stream(1); s(2); s.map(x => x*2)`. Separate import. |

---

## 12. Common patterns

```tsx
// Conditional
{this.open && <Modal />}
{this.user ? <Profile user={this.user}/> : <Login/>}

// Lists
{items.map(i => <Row key={i.id} item={i} />)}

// Shared/global state = just a module
// state.ts
export const store = { user: null as User | null, cart: [] as Item[] }
// any component: store.cart.push(x) → redraw shows it everywhere

// Passing callbacks up (child → parent)
<Child onSave={(val: string) => this.value = val} />
// in Child: v.attrs.onSave("x")

// Forwarding attrs (like Link does)
m("button", { ...v.attrs, class: "btn" }, v.children)
```

- 💡 Mithril doesn't need Redux/Context: since every redraw re-renders from the root, a plain imported object *is* reactive enough.

---

## 13. Gotchas checklist

- [ ] UI doesn't update after `fetch`/`setTimeout`/`await` → `m.redraw()`.
- [ ] `v.dom` is `undefined` → you're in `oninit`/`view`; use `oncreate`.
- [ ] Route param changed but data didn't reload → component reused; use `onbeforeupdate` or a `key`.
- [ ] "Vnodes must either all have keys or none" → mixed keyed/unkeyed siblings.
- [ ] Full page reload on click → used `<a>` instead of `m.route.Link` / `<Link>`.
- [ ] Memory leaks / double listeners → clean up in `onremove`.
- [ ] Infinite loop → `m.redraw()` in `view`/`onupdate`.
- [ ] `<>…</>` doesn't compile → use `<Frag>` or an array.
- [ ] Mutating `v.attrs` → don't; keep your own state in class fields.

---

## 14. Template map

| File | Concept |
|---|---|
| [main.tsx](src/main.tsx) | `m.route`, `prefix`, RouteResolver w/ lazy `import()` + layout `render` |
| [layout.tsx](src/pages/layout.tsx) | Component using `v.children` |
| [test.tsx](src/pages/test.tsx) | Route param via `v.attrs.id` |
| [link.tsx](src/components/link.tsx) | Wrapping `m.route.Link`, spreading attrs, chaining `onclick` |
| [frag.tsx](src/components/frag.tsx) | Fragment workaround (return `v.children`) |
| [Svg.tsx](src/components/Svg.tsx) | `oninit`, `onbeforeupdate(v, old)`, `onupdate` + `v.dom`, `m.trust`, manual `m.redraw()` after async |

Docs: https://mithril.js.org/ (API list in the sidebar: Core / Optional / Tooling).

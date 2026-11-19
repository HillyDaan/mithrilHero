import m from "mithril"
import { Layout } from "./pages/layout"
import "./main.scss"

m.route.prefix = ""

m.route(document.getElementById("app")!, "/", {
  "/": {
    onmatch: () => import("./pages/home").then(x => x.Page),
    render: v => <Layout>{v}</Layout>
  },

  "/test/:id": {
    onmatch: () => import("./pages/test").then(x => x.Page),
    render: v => <Layout>{v}</Layout>
  },

  "/users": {
    onmatch: () => import("./pages/users").then(x => x.Page),
    render: v => <Layout>{v}</Layout>
  },
})

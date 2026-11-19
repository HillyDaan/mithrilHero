import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"

export class Frag extends MithrilTsxComponent<{}> {
  view(v: m.Vnode) {
    return v.children
  }
}

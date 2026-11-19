import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import { Svg } from "@root/components/Svg"

export class Layout extends MithrilTsxComponent<{}> {
  view(v: m.Vnode) {
    return <div>
      <header className="layout-header">
        <Svg name="check" />
      </header>
      <main className="layout-main">{v.children}</main>
    </div>
  }
}

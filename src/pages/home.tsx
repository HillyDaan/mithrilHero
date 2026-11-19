import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import { Link } from "@root/components/link"

export interface IPage {

}

export class Page extends MithrilTsxComponent<IPage> {
  view(v: m.Vnode<IPage>) {
    return <div className="stack">
      <h1 className="fs1">Frontend starter</h1>
      <p className="subtitle">Minimal Mithril + TSX + SCSS setup. Edit src/pages/home.tsx.</p>
      <div className="row">
        <Link className="btn-primary" href="/test/123">Bekijk demo pagina</Link>
        <Link className="btn-primary" href="/users">Users</Link>
      </div>
    </div>
  }
}

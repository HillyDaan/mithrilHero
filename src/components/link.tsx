import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"

interface ILink {
  href: string
  className?: string
  onclick?: (e: MouseEvent) => void
}

export class Link extends MithrilTsxComponent<ILink> {
  view(v: m.Vnode<ILink>) {
    return m(m.route.Link, {
      ...v.attrs,
      onclick: (e: MouseEvent) => {
        window.scrollTo({ left: 0, top: 0, behavior: "smooth" })
        v.attrs.onclick?.(e)
      }
    }, v.children)
  }
}

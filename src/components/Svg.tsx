import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"

export interface ISvg {
  name: string
  folder?: string
  onload?: (svg: SVGElement) => any
}

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

export class Svg extends MithrilTsxComponent<ISvg> {
  svg: string | null = null
  loaded: boolean = false
  loadingName: string | null = null

  view(v: m.Vnode<ISvg>) {
    if (!this.svg)
      return

    return m.trust(this.svg)
  }

  oninit(v: m.Vnode<ISvg>) {
    const cached = cache.get(v.attrs.name)

    if (cached) {
      this.svg = cached
      return
    }

    this.load(v.attrs.name, v.attrs.folder)
  }

  onbeforeupdate(v: m.Vnode<ISvg>, o: m.Vnode<ISvg>) {
    if (v.attrs.name !== o.attrs.name)
      this.load(v.attrs.name, v.attrs.folder)
  }

  onupdate(v: m.VnodeDOM<ISvg>) {
    if (!this.svg || this.loaded)
      return

    this.loaded = true
    v.attrs.onload?.(v.dom as SVGElement)
    v.dom.setAttribute('aria-hidden', 'true')
    v.dom.setAttribute('focusable', 'false')
  }

  async load(name: string, folder?: string) {
    if (!name || name === this.loadingName)
      return

    this.loadingName = name

    let promise = pending.get(name)

    if (!promise) {
      promise = import(`@root/assets/${folder || "icons"}/${name}.svg`).then(x => x.default)
      pending.set(name, promise)
    }

    const svg = await promise

    cache.set(name, svg)

    if (this.loadingName !== name || svg === this.svg)
      return

    this.loaded = false
    this.svg = svg
    m.redraw()
  }
}

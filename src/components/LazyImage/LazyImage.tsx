import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import "./LazyImage.scss"

export interface ILazyImage {
    alt?: string
}

type Status = "loading" | "loaded" | "error"

/**
 * Widths we're allowed to request. Snapping to a fixed set means containers of
 * roughly the same size request the exact same URL, so the browser (and later
 * our own cache) can reuse it instead of downloading a new image for every pixel.
 */
const WIDTHS = [320, 640, 960, 1280, 1600, 1920, 2560]

/** Smallest known width that is at least as big as needed, or the largest one */
function pickWidth(needed: number): number {
    return WIDTHS.find(width => width >= needed) ?? WIDTHS[WIDTHS.length - 1]
}

export class LazyImage extends MithrilTsxComponent<ILazyImage> {
    private status: Status = "loading"
    private objectUrl: string | null = null
    private controller = new AbortController()

    // oninit has no DOM yet, so measuring happens in oncreate:
    // the skeleton is rendered first, then we read its size.
    oncreate(v: m.VnodeDOM<ILazyImage>) {
        const rect = (v.dom as HTMLElement).getBoundingClientRect()

        // Retina screens need more pixels than the CSS size
        const ratio = window.devicePixelRatio || 1
        const width = pickWidth(rect.width * ratio)

        // Keep the container's shape; fall back to 16:9 if it has no height yet
        const shape = rect.width > 0 && rect.height > 0 ? rect.height / rect.width : 9 / 16
        const height = Math.round(width * shape)

        // Picsum's random endpoint picks a random photo for us. The ?random= value
        // makes every URL unique so the browser never serves a cached one.
        this.load(`https://picsum.photos/${width}/${height}?random=${Math.random()}`)
    }

    private async load(url: string) {
        try {
            const response = await fetch(url, { signal: this.controller.signal })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const blob = await response.blob()
            this.objectUrl = URL.createObjectURL(blob)
            this.status = "loaded"
        } catch (error) {
            // Component was removed while loading: don't touch state or redraw
            if ((error as Error).name === "AbortError") return
            this.status = "error"
        }

        // fetch() is not Mithril's own request function, so Mithril doesn't know
        // anything changed. Tell it to redraw so view() runs with the new status.
        m.redraw()
    }

    onremove() {
        this.controller.abort()
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    }

    view(v: m.Vnode<ILazyImage>) {
        // The wrapper is always rendered: it's the skeleton while loading
        // and the box we measure in oncreate.
        let className = "LazyImage"
        if (this.status === "loading") className += " LazyImageLoading"
        if (this.status === "error") className += " LazyImageError"

        return (
            <div className={className}>
                {this.status === "loaded" && (
                    <img className="LazyImageImg" src={this.objectUrl!} alt={v.attrs.alt ?? ""} />
                )}
                {this.status === "error" && (
                    <span className="LazyImageErrorText">Image could not be loaded</span>
                )}
            </div>
        )
    }
}
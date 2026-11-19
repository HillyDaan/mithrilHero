import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import "./LazyImage.scss"

/**
 * Variant of LazyImage where loading and showing are split up:
 * - loadImage() fetches (and decodes) an image without anything being mounted,
 *   so a parent can wait for the next image before switching to it.
 * - PreloadedLazyImage only shows the result (same markup/classes as LazyImage).
 *
 * The measuring, width snapping and URL logic is the same as in LazyImage.
 */

export type Status = "loading" | "loaded" | "error"

export type PreloadedImage =
    | { status: "loading" }
    | { status: "loaded"; objectUrl: string }
    | { status: "error" }

export interface IPreloadedLazyImage {
    image: PreloadedImage
    alt?: string
}

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

/**
 * Builds the image URL for an element. LazyImage measures itself in oncreate;
 * here the caller passes in the element the image will fill (it has to be in the DOM).
 */
export function imageUrlFor(element: Element): string {
    const rect = element.getBoundingClientRect()

    // Retina screens need more pixels than the CSS size
    const ratio = window.devicePixelRatio || 1
    const width = pickWidth(rect.width * ratio)

    // Keep the container's shape; fall back to 16:9 if it has no height yet
    const shape = rect.width > 0 && rect.height > 0 ? rect.height / rect.width : 9 / 16
    const height = Math.round(width * shape)

    // Picsum's random endpoint picks a random photo for us. The ?random= value
    // makes every URL unique so the browser never serves a cached one.
    return `https://picsum.photos/${width}/${height}?random=${Math.random()}`
}

/**
 * Same fetch as LazyImage.load(), but returns the result instead of storing it.
 * It also decodes the image first, so showing it later doesn't stutter.
 *
 * Rejects with an AbortError when `signal` is aborted (also if that happens after
 * the download finished; the object URL is cleaned up in that case).
 * Whoever receives a "loaded" result owns the object URL; PreloadedLazyImage
 * revokes it when it's removed.
 */
export async function loadImage(url: string, signal: AbortSignal): Promise<PreloadedImage> {
    let objectUrl: string | null = null

    try {
        const response = await fetch(url, { signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)

        // Decode up front: a big image that's only decoded once it's shown
        // can drop frames right at the start of a transition.
        const img = new Image()
        img.src = objectUrl
        await img.decode()

        // Aborted while decoding: the result isn't wanted anymore
        signal.throwIfAborted()

        return { status: "loaded", objectUrl }
    } catch (error) {
        if (objectUrl) URL.revokeObjectURL(objectUrl)

        // Let the caller see aborts, so it knows to ignore this load
        if ((error as Error).name === "AbortError") throw error
        return { status: "error" }
    }
}

export class PreloadedLazyImage extends MithrilTsxComponent<IPreloadedLazyImage> {
    // The object URL is ours from the moment we receive it
    onremove(v: m.VnodeDOM<IPreloadedLazyImage>) {
        const { image } = v.attrs
        if (image.status === "loaded") URL.revokeObjectURL(image.objectUrl)
    }

    view(v: m.Vnode<IPreloadedLazyImage>) {
        const { image } = v.attrs

        // The wrapper is always rendered: it's the skeleton while loading
        let className = "LazyImage"
        if (image.status === "loading") className += " LazyImageLoading"
        if (image.status === "error") className += " LazyImageError"

        return (
            <div className={className}>
                {image.status === "loaded" && (
                    <img className="LazyImageImg" src={image.objectUrl} alt={v.attrs.alt ?? ""} />
                )}
                {image.status === "error" && (
                    <span className="LazyImageErrorText">Image could not be loaded</span>
                )}
            </div>
        )
    }
}

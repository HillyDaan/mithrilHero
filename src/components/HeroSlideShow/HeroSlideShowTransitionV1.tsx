import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import {
    PreloadedLazyImage,
    imageUrlFor,
    loadImage,
    type PreloadedImage,
} from "@root/components/LazyImage/PreloadedLazyImage"
import type { IHeroSlideShow, IHeroSlideShowItem } from "@root/components/HeroSlideShow/HeroSlideShow"
import "./HeroSlideShow.scss"
import "./HeroSlideShowTransition.scss"

/*
 * V1 of HeroSlideShowTransition: the version without the queueClicks toggle.
 * A click always replaces whatever was pending (spam clicking jumps to the last
 * slide you clicked, clicking back to the shown slide cancels the load).
 */

type Direction = "next" | "prev"

/** Longest an exit may take; a safety net in case an animation never finishes */
const EXIT_TIMEOUT = 2000

interface IHeroTransitionSlide {
    item: IHeroSlideShowItem
    image: PreloadedImage
    /** Grows with every slide, so older leaving slides can be stacked on top */
    id: number
    /** Direction of the latest navigation, read when this slide starts its exit */
    getDirection: () => Direction
}

/**
 * One slide. Its image is already loaded when it mounts, so all it does on
 * removal is play the exit animation (onbeforeremove keeps it on the page until then).
 */
class HeroTransitionSlide extends MithrilTsxComponent<IHeroTransitionSlide> {
    onbeforeremove(v: m.VnodeDOM<IHeroTransitionSlide>) {
        // Nothing shown yet (initial skeleton): nothing to transition from
        if (v.attrs.image.status === "loading") return

        const dom = v.dom as HTMLElement

        // Mithril has dropped this vnode and won't redraw it, so the exit is started on the DOM directly
        dom.classList.add("HeroTransitionSlideExit")

        // v.attrs are from before the click, so ask for the current direction.
        // Set per element, so a click mid-wipe can't flip a wipe that's already running.
        dom.dataset.direction = v.attrs.getDirection()

        // Mithril appends the new slide after this one, so without a z-index it would cover the wipe.
        // Based on id so older exiting slides stay above newer ones when wipes overlap.
        dom.style.zIndex = String(1_000_000 - v.attrs.id)

        // Wait for every CSS animation the Exit class started (on this element and inside it),
        // with a timeout so a stray infinite animation can never keep it around forever.
        const animations = dom.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))
        const timeout = new Promise<void>(resolve => setTimeout(resolve, EXIT_TIMEOUT))

        return Promise.race([Promise.all(animations), timeout])
    }

    view(v: m.Vnode<IHeroTransitionSlide>) {
        const { item, image } = v.attrs
        const ready = image.status !== "loading"

        return (
            <div className={ready ? "HeroTransitionSlide HeroTransitionSlideReady" : "HeroTransitionSlide"}>
                <div className="HeroTransitionSlideMedia">
                    <PreloadedLazyImage alt={item.title} image={image} />
                </div>

                <div className="HeroSlideShowText">
                    <h2 className="HeroSlideShowTitle">{item.title}</h2>

                    {item.description && <div className="HeroSlideShowDescription">{item.description}</div>}

                    {item.cta && (
                        <button type="button" className="HeroSlideShowCta" onclick={() => item.cta?.(item)}>
                            {item.ctaLabel ?? "Learn more"}
                        </button>
                    )}
                </div>
            </div>
        )
    }
}

/**
 * Slideshow that only keeps the current slide's image mounted, but still
 * transitions smoothly. Navigating doesn't switch slides right away: it first
 * loads the next image (showing a loading state on the current slide), and only
 * switches once it's there. The old slide then wipes away via onbeforeremove.
 */
export class HeroSlideShowTransitionV1 extends MithrilTsxComponent<IHeroSlideShow> {
    /** Slide that's on screen */
    private currentIndex = 0
    /** Slide the user asked for; differs from currentIndex while its image loads */
    private targetIndex = 0
    private image: PreloadedImage = { status: "loading" }
    private slideId = 0
    private direction: Direction = "next"
    /** Set while an image is loading; aborting it cancels that load */
    private controller: AbortController | null = null
    private dom: Element | null = null

    oninit(v: m.Vnode<IHeroSlideShow>) {
        this.currentIndex = this.targetIndex = Math.max(v.attrs.initialOpen ?? 0, 0)
        this.clampToItems(v.attrs.items.length)
    }

    // Needs the DOM to measure how big the image should be.
    // view() always renders the same <section>, so this element stays valid.
    oncreate(v: m.VnodeDOM<IHeroSlideShow>) {
        this.dom = v.dom
        this.load()
    }

    // Items can be added or removed by whoever renders us; keep the indexes valid
    onbeforeupdate(v: m.Vnode<IHeroSlideShow>) {
        this.clampToItems(v.attrs.items.length)
    }

    onremove() {
        this.controller?.abort()
    }

    /** Wraps around: past the last slide goes to the first, before the first goes to the last */
    private wrap(index: number, count: number) {
        return ((index % count) + count) % count
    }

    /**
     * The one place that keeps both indexes inside the list, whatever its length.
     * An empty list just means index 0 with nothing rendered for it.
     */
    private clampToItems(count: number) {
        const last = Math.max(count - 1, 0)
        this.currentIndex = Math.min(this.currentIndex, last)
        this.targetIndex = Math.min(this.targetIndex, last)

        // The slide we were loading got removed and the target fell back onto the shown one
        if (this.targetIndex === this.currentIndex && this.image.status !== "loading") this.cancelLoad()
    }

    private cancelLoad() {
        this.controller?.abort()
        this.controller = null
    }

    // Only called from the controls, which only exist when there are 2+ items
    private goTo(index: number, count: number, direction?: Direction) {
        const target = this.wrap(index, count)

        // Already there, or already loading it
        if (target === this.targetIndex) return

        this.targetIndex = target
        this.direction = direction ?? (target > this.currentIndex ? "next" : "prev")

        // Went back to the slide that's on screen: just stop loading the other one

        this.load()
    }

    /**
     * Loads an image for the target slide and switches to it once it's there.
     * A newer call aborts this one, so only the last click ever switches.
     */
    private async load() {
        if (!this.dom) return

        this.controller?.abort()
        const controller = new AbortController()
        this.controller = controller

        let image: PreloadedImage
        try {
            image = await loadImage(imageUrlFor(this.dom), controller.signal)
        } catch {
            // Aborted: a newer navigation took over, it will do the switching
            return
        }

        // Aborted right as it finished (e.g. it failed and a newer click came in at the same time)
        if (controller.signal.aborted) {
            if (image.status === "loaded") URL.revokeObjectURL(image.objectUrl)
            return
        }

        this.controller = null
        // Read the target now rather than when the load started: if items were
        // removed meanwhile, clampToItems has already moved it to a valid index
        this.currentIndex = this.targetIndex
        this.image = image
        // New key: Mithril removes the old slide, which plays its exit in onbeforeremove
        this.slideId++

        // fetch() is not Mithril's own request function, so tell it to redraw
        m.redraw()
    }

    private getDirection = () => this.direction

    view(v: m.Vnode<IHeroSlideShow>) {
        const { items } = v.attrs
        const count = items.length
        // Undefined only when the list is empty
        const item = items[this.currentIndex]

        const loading = this.controller !== null

        // Always the same root element, even with no items: oncreate's `this.dom`
        // must stay the element that's actually on the page
        return (
            <section className={loading ? "HeroSlideShow HeroTransition HeroTransitionLoading" : "HeroSlideShow HeroTransition"}>
                <div className="HeroTransitionStage">
                    {/* At most one slide in the vdom; leaving ones only live on in the DOM.
                        If the list empties, the last slide just plays its exit. */}
                    {[
                        item && (
                            <HeroTransitionSlide
                                key={this.slideId}
                                id={this.slideId}
                                item={item}
                                image={this.image}
                                getDirection={this.getDirection}
                            />
                        ),
                    ]}
                </div>

                <div className="HeroTransitionProgress" />

                {count > 1 && (
                    <div className="HeroSlideShowControls">
                        <button
                            type="button"
                            className="HeroSlideShowArrow"
                            onclick={() => this.goTo(this.targetIndex - 1, count, "prev")}
                        >
                            ‹
                        </button>

                        {/* Dots and counter follow the target, so clicks feel instant */}
                        <div className="HeroSlideShowDots">
                            {items.map((_, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    className={index === this.targetIndex ? "HeroSlideShowDot HeroSlideShowDotActive" : "HeroSlideShowDot"}
                                    onclick={() => this.goTo(index, count)}
                                />
                            ))}
                        </div>

                        <span className="HeroSlideShowCounter">
                            {this.targetIndex + 1} / {count}
                        </span>

                        <button
                            type="button"
                            className="HeroSlideShowArrow"
                            onclick={() => this.goTo(this.targetIndex + 1, count, "next")}
                        >
                            ›
                        </button>
                    </div>
                )}
            </section>
        )
    }
}

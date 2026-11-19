import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import type { IHeroSlideShowItem } from "@root/components/HeroSlideShow/HeroSlideShow"
import "./HeroSlideShow.scss"
import "./HeroSlideShowTransition.scss"
import "./HeroSlideShowMinimal.scss"

/*
 * Production-style version of HeroSlideShowTransition:
 * - Images have real, stable URLs, so the browser cache does the heavy lifting:
 *   no fetch/blob/object URLs, just new Image() + decode() to preload.
 * - The browser picks the resolution through srcset/sizes, no measuring.
 * - The first slide is a plain <img> (fetchpriority high), not loaded by JS,
 *   so it doesn't delay the page's Largest Contentful Paint.
 * - Next/previous are preloaded when the browser is idle, so most clicks swap
 *   instantly. Only when an image isn't ready yet do we show the loading state.
 * - Only one slide is rendered; the old one stays just for its exit (onbeforeremove).
 */

type Direction = "next" | "prev"

/** Longest an exit may take; a safety net in case an animation never finishes */
const EXIT_TIMEOUT = 2000
/** Horizontal pixels a swipe needs before it counts */
const SWIPE_THRESHOLD = 50

export interface IHeroSlideShowMinimalItem extends IHeroSlideShowItem {
    src: string
    /** e.g. "image-800.jpg 800w, image-1600.jpg 1600w" */
    srcset?: string
    /** Defaults to the title */
    alt?: string
}

export interface IHeroSlideShowMinimal {
    items: IHeroSlideShowMinimalItem[]
    initialOpen?: number
    /** How wide the image is shown, so the browser can pick from srcset. Defaults to full width. */
    sizes?: string
    /** Name of the carousel for screen readers */
    label?: string
}

interface IMinimalSlide {
    item: IHeroSlideShowMinimalItem
    /** Grows with every slide, so older exiting slides can be stacked on top */
    id: number
    position: string
    sizes: string
    /** The very first slide: shown as-is, no entrance animation */
    initial: boolean
    /** Direction of the latest navigation, read when this slide starts its exit */
    getDirection: () => Direction
}

class MinimalSlide extends MithrilTsxComponent<IMinimalSlide> {
    onbeforeremove(v: m.VnodeDOM<IMinimalSlide>) {
        const dom = v.dom as HTMLElement

        // Mithril has dropped this vnode and won't redraw it, so the exit is started on the DOM directly
        dom.classList.add("HeroTransitionSlideExit")
        dom.dataset.direction = v.attrs.getDirection()
        // Mithril appends the new slide after this one; lift the exiting one above it.
        // Based on id so older exiting slides stay above newer ones when wipes overlap.
        dom.style.zIndex = String(1_000_000 - v.attrs.id)
        dom.setAttribute("aria-hidden", "true")

        const animations = dom.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))
        const timeout = new Promise<void>(resolve => setTimeout(resolve, EXIT_TIMEOUT))
        return Promise.race([Promise.all(animations), timeout])
    }

    view(v: m.Vnode<IMinimalSlide>) {
        const { item, position, sizes, initial } = v.attrs

        return (
            <div
                className={initial ? "HeroTransitionSlide HeroTransitionSlideReady HeroMinimalInitial" : "HeroTransitionSlide HeroTransitionSlideReady"}
                role="group"
                aria-roledescription="slide"
                aria-label={position}
            >
                <div className="HeroTransitionSlideMedia">
                    <img
                        className="HeroMinimalImg"
                        src={item.src}
                        srcset={item.srcset}
                        sizes={sizes}
                        alt={item.alt ?? item.title}
                        draggable={false}
                        fetchpriority={initial ? "high" : undefined}
                    />
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

export class HeroSlideShowMinimal extends MithrilTsxComponent<IHeroSlideShowMinimal> {
    private items: IHeroSlideShowMinimalItem[] = []
    private sizes = "100vw"

    /** Slide that's on screen */
    private currentIndex = 0
    /** Slide the user asked for; differs from currentIndex while its image loads */
    private targetIndex = 0
    private direction: Direction = "next"
    private slideId = 0
    private loading = false
    /** Bumped on every navigation; a load that finishes with an old token is ignored */
    private token = 0
    private swipeStartX: number | null = null

    /** Images the browser has downloaded and decoded */
    private ready = new Set<string>()
    /** Preloads in progress, so the same image is never requested twice */
    private pending = new Map<string, Promise<void>>()

    oninit(v: m.Vnode<IHeroSlideShowMinimal>) {
        this.syncAttrs(v.attrs)
        this.currentIndex = this.targetIndex = Math.min(Math.max(v.attrs.initialOpen ?? 0, 0), this.lastIndex)
    }

    oncreate() {
        // The first slide's <img> is rendered directly, nothing to wait for
        const first = this.items[this.currentIndex]
        if (first) this.ready.add(first.src)
        this.preloadNeighbours()
    }

    onbeforeupdate(v: m.Vnode<IHeroSlideShowMinimal>) {
        this.syncAttrs(v.attrs)

        // Items were removed: stay inside the list, and drop a navigation to a slide that's gone
        if (this.currentIndex > this.lastIndex || this.targetIndex > this.lastIndex) {
            this.currentIndex = Math.min(this.currentIndex, this.lastIndex)
            this.targetIndex = this.currentIndex
            this.token++
            this.loading = false
        }
    }

    private syncAttrs(attrs: IHeroSlideShowMinimal) {
        this.items = attrs.items
        this.sizes = attrs.sizes ?? "100vw"
    }

    private get lastIndex() {
        return Math.max(this.items.length - 1, 0)
    }

    /** Wraps around: past the last slide goes to the first, before the first goes to the last */
    private wrap(index: number) {
        const count = this.items.length
        return ((index % count) + count) % count
    }

    /** Downloads and decodes an image without showing it. Never rejects: a broken image still gets shown (as its alt). */
    private preload(item: IHeroSlideShowMinimalItem): Promise<void> {
        if (this.ready.has(item.src)) return Promise.resolve()

        let promise = this.pending.get(item.src)
        if (!promise) {
            const img = new Image()
            // Same sizes/srcset as the real <img>, so the browser picks (and caches) the same file
            img.sizes = this.sizes
            if (item.srcset) img.srcset = item.srcset
            img.src = item.src

            promise = img
                .decode()
                .catch(() => {})
                .then(() => {
                    this.ready.add(item.src)
                    this.pending.delete(item.src)
                })
            this.pending.set(item.src, promise)
        }
        return promise
    }

    /** Warm up next and previous once the browser has nothing better to do */
    private preloadNeighbours() {
        if (this.items.length < 2) return

        const run = () => {
            this.preload(this.items[this.wrap(this.currentIndex + 1)])
            this.preload(this.items[this.wrap(this.currentIndex - 1)])
        }

        if ("requestIdleCallback" in window) requestIdleCallback(run)
        else setTimeout(run, 200)
    }

    // Only called from the controls/keys/swipes, which only do something with 2+ items
    private async goTo(index: number, direction?: Direction) {
        if (this.items.length < 2) return

        const target = this.wrap(index)
        if (target === this.targetIndex) return

        direction ??= target > this.targetIndex ? "next" : "prev"
        this.targetIndex = target
        const token = ++this.token

        // Back to the slide on screen: forget the pending navigation
        if (target === this.currentIndex) {
            this.loading = false
            return
        }

        const item = this.items[target]
        if (!this.ready.has(item.src)) {
            this.loading = true
            await this.preload(item)
            // Another navigation happened while we waited: that one takes over
            if (token !== this.token) return
        }

        this.loading = false
        this.direction = direction
        this.currentIndex = target
        // New key: Mithril removes the old slide, which plays its exit in onbeforeremove
        this.slideId++
        m.redraw()

        this.preloadNeighbours()
    }

    private getDirection = () => this.direction

    private onkeydown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") this.goTo(this.targetIndex - 1, "prev")
        else if (e.key === "ArrowRight") this.goTo(this.targetIndex + 1, "next")
        else (e as KeyboardEvent & { redraw?: boolean }).redraw = false // nothing changed, skip Mithril's redraw
    }

    private onpointerdown = (e: PointerEvent) => {
        this.swipeStartX = e.clientX
    }

    private onpointerup = (e: PointerEvent) => {
        if (this.swipeStartX === null) return
        const distance = e.clientX - this.swipeStartX
        this.swipeStartX = null

        if (Math.abs(distance) < SWIPE_THRESHOLD) return
        if (distance < 0) this.goTo(this.targetIndex + 1, "next")
        else this.goTo(this.targetIndex - 1, "prev")
    }

    view(v: m.Vnode<IHeroSlideShowMinimal>) {
        const { items } = this
        const count = items.length
        const item = items[this.currentIndex]

        return (
            <section
                className={this.loading ? "HeroSlideShow HeroTransition HeroTransitionLoading" : "HeroSlideShow HeroTransition"}
                role="region"
                aria-roledescription="carousel"
                aria-label={v.attrs.label ?? "Featured"}
                tabindex={0}
                onkeydown={this.onkeydown}
            >
                <div
                    className="HeroTransitionStage HeroMinimalStage"
                    aria-live="polite"
                    onpointerdown={this.onpointerdown}
                    onpointerup={this.onpointerup}
                >
                    {[
                        item && (
                            <MinimalSlide
                                key={this.slideId}
                                id={this.slideId}
                                item={item}
                                position={`${this.currentIndex + 1} of ${count}`}
                                sizes={this.sizes}
                                initial={this.slideId === 0}
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
                            aria-label="Previous slide"
                            onclick={() => this.goTo(this.targetIndex - 1, "prev")}
                        >
                            ‹
                        </button>

                        <div className="HeroSlideShowDots">
                            {items.map((_, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    className={index === this.targetIndex ? "HeroSlideShowDot HeroSlideShowDotActive" : "HeroSlideShowDot"}
                                    aria-label={`Go to slide ${index + 1}`}
                                    aria-current={index === this.targetIndex ? "true" : undefined}
                                    onclick={() => this.goTo(index)}
                                />
                            ))}
                        </div>

                        <span className="HeroSlideShowCounter" aria-hidden="true">
                            {this.targetIndex + 1} / {count}
                        </span>

                        <button
                            type="button"
                            className="HeroSlideShowArrow"
                            aria-label="Next slide"
                            onclick={() => this.goTo(this.targetIndex + 1, "next")}
                        >
                            ›
                        </button>
                    </div>
                )}
            </section>
        )
    }
}

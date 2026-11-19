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
    /** Gets a promise for this slide's exit, so the slideshow can wait for it to finish */
    onExit: (finished: Promise<void>) => void
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

        const finished = Promise.race([Promise.all(animations), timeout]).then(() => {})
        v.attrs.onExit(finished)
        return finished
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

export interface IHeroSlideShowTransition extends IHeroSlideShow {
    /**
     * false (default): a click replaces whatever was pending; spam clicking jumps
     * straight to the last slide you clicked, and clicking back cancels.
     * true: every click is queued and plays its own transition, one after another.
     */
    queueClicks?: boolean
}

/** One navigation the user asked for */
interface Step {
    index: number
    direction: Direction
}

/**
 * Slideshow that only keeps the current slide's image mounted, but still
 * transitions smoothly. Navigating doesn't switch slides right away: it first
 * loads the next image (showing a loading state on the current slide), and only
 * switches once it's there. The old slide then wipes away via onbeforeremove.
 */
export class HeroSlideShowTransition extends MithrilTsxComponent<IHeroSlideShowTransition> {
    /** Slide that's on screen */
    private currentIndex = 0
    private image: PreloadedImage = { status: "loading" }
    private slideId = 0
    private direction: Direction = "next"
    private count = 0
    private queueClicks = false

    /** Navigations still to do; run() works through them one at a time */
    private steps: Step[] = []
    private running = false
    /** Shown while we're waiting on an image (the loading bar / dimmed slide) */
    private loading = false
    /** For the image being loaded right now; aborting it cancels that load */
    private controller: AbortController | null = null
    /** Resolves when the last exiting slide finished its wipe */
    private exitDone: Promise<void> = Promise.resolve()
    private dom: Element | null = null

    oninit(v: m.Vnode<IHeroSlideShowTransition>) {
        this.syncAttrs(v.attrs)
        this.currentIndex = Math.min(Math.max(v.attrs.initialOpen ?? 0, 0), this.lastIndex)
    }

    // Needs the DOM to measure how big the image should be.
    // view() always renders the same <section>, so this element stays valid.
    oncreate(v: m.VnodeDOM<IHeroSlideShowTransition>) {
        this.dom = v.dom
        this.steps = [{ index: this.currentIndex, direction: "next" }]
        this.run()
    }

    // Items can be added or removed by whoever renders us; keep the index valid
    onbeforeupdate(v: m.Vnode<IHeroSlideShowTransition>) {
        this.syncAttrs(v.attrs)
        this.currentIndex = Math.min(this.currentIndex, this.lastIndex)
    }

    onremove() {
        this.steps = []
        this.controller?.abort()
    }

    private syncAttrs(attrs: IHeroSlideShowTransition) {
        this.count = attrs.items.length
        this.queueClicks = attrs.queueClicks ?? false
    }

    /** Last valid index; 0 for an empty list (which then just renders no slide) */
    private get lastIndex() {
        return Math.max(this.count - 1, 0)
    }

    /** Where we'll end up once all steps are done; what the dots and counter show */
    private get targetIndex() {
        return Math.min(this.steps.at(-1)?.index ?? this.currentIndex, this.lastIndex)
    }

    /** Wraps around: past the last slide goes to the first, before the first goes to the last */
    private wrap(index: number) {
        return ((index % this.count) + this.count) % this.count
    }

    // Only called from the controls, which only exist when there are 2+ items
    private goTo(index: number, direction?: Direction) {
        const target = this.wrap(index)

        // Already there, or already on its way there
        if (target === this.targetIndex) return

        const step = { index: target, direction: direction ?? (target > this.targetIndex ? "next" : "prev") } as Step

        if (this.queueClicks) {
            // Every click gets its own transition, also going back to where we started
            this.steps.push(step)
        } else {
            // Only the latest click counts. Going back to the slide on screen
            // means there's nothing left to do: just stop loading the other one.
            const backToCurrent = target === this.currentIndex && this.image.status !== "loading"
            this.steps = backToCurrent ? [] : [step]
            this.controller?.abort()
        }

        this.run()
    }

    /**
     * Works through the steps one at a time: load the image, then switch.
     * Only ever one load at a time, and only one copy of this loop running.
     */
    private async run() {
        if (this.running) return
        this.running = true

        while (this.steps.length > 0 && this.dom) {
            const step = this.steps[0]
            const controller = new AbortController()
            this.controller = controller

            let loaded = false
            const loading = loadImage(imageUrlFor(this.dom), controller.signal).finally(() => (loaded = true))
            loading.catch(() => {}) // handled below; avoids an "unhandled rejection" while we wait

            // Queued: let the previous wipe finish first. The image loads meanwhile,
            // so if it's quick there's no loading state at all between the wipes.
            if (this.queueClicks) await this.exitDone

            if (!loaded) {
                this.loading = true
                m.redraw()
            }

            let image: PreloadedImage
            try {
                image = await loading
            } catch {
                // Aborted: a click replaced the steps (or we got removed); look at them again
                continue
            }

            // Aborted right as it finished (e.g. it failed and a click came in at the same time)
            if (controller.signal.aborted) {
                if (image.status === "loaded") URL.revokeObjectURL(image.objectUrl)
                continue
            }

            this.steps.shift()
            this.controller = null
            this.loading = false

            // Items may have been removed while loading: stay inside the list
            const index = Math.min(step.index, this.lastIndex)
            this.direction = step.direction
            this.currentIndex = index
            this.image = image
            // New key: Mithril removes the old slide, which plays its exit in onbeforeremove
            this.slideId++

            // Redraw right now (not on the next frame), so the old slide's onbeforeremove
            // has already handed us its exit promise before the next step waits on it
            m.redraw.sync()
        }

        this.running = false
        this.controller = null
        if (this.loading) {
            this.loading = false
            m.redraw()
        }
    }

    private getDirection = () => this.direction

    private onExit = (finished: Promise<void>) => {
        this.exitDone = finished
    }

    view(v: m.Vnode<IHeroSlideShowTransition>) {
        const { items } = v.attrs
        const count = items.length
        // Undefined only when the list is empty
        const item = items[this.currentIndex]

        // Always the same root element, even with no items: oncreate's `this.dom`
        // must stay the element that's actually on the page
        return (
            <section className={this.loading ? "HeroSlideShow HeroTransition HeroTransitionLoading" : "HeroSlideShow HeroTransition"}>
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
                                onExit={this.onExit}
                            />
                        ),
                    ]}
                </div>

                <div className="HeroTransitionProgress" />

                {count > 1 && (
                    <div className="HeroSlideShowControls">
                        <button type="button" className="HeroSlideShowArrow" onclick={() => this.goTo(this.targetIndex - 1, "prev")}>
                            ‹
                        </button>

                        {/* Dots and counter follow the target, so clicks feel instant */}
                        <div className="HeroSlideShowDots">
                            {items.map((_, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    className={index === this.targetIndex ? "HeroSlideShowDot HeroSlideShowDotActive" : "HeroSlideShowDot"}
                                    onclick={() => this.goTo(index)}
                                />
                            ))}
                        </div>

                        <span className="HeroSlideShowCounter">
                            {this.targetIndex + 1} / {count}
                        </span>

                        <button type="button" className="HeroSlideShowArrow" onclick={() => this.goTo(this.targetIndex + 1, "next")}>
                            ›
                        </button>
                    </div>
                )}
            </section>
        )
    }
}

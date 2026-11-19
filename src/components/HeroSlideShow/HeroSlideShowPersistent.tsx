import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import { LazyImage } from "@root/components/LazyImage/LazyImage"
import type { IHeroSlideShow } from "@root/components/HeroSlideShow/HeroSlideShow"
import "./HeroSlideShow.scss"

/**
 * Same as HeroSlideShow, but every slide's image stays mounted.
 * An image is only fetched the first time its slide becomes active,
 * and after that it simply stays loaded.
 */
export class HeroSlideShowPersistent extends MithrilTsxComponent<IHeroSlideShow> {
    private currentIndex = 0

    /** Wraps around: past the last slide goes to the first, before the first goes to the last */
    private goTo(index: number, count: number) {
        if (count === 0) return
        this.currentIndex = ((index % count) + count) % count
    }

    oninit(v: m.Vnode<IHeroSlideShow>) {
        this.goTo(v.attrs.initialOpen ?? 0, v.attrs.items.length)
    }

    view(v: m.Vnode<IHeroSlideShow>) {
        const { items, fadeDuration: slideDuration = 300 } = v.attrs
        const count = items.length

        if (count === 0) return null

        return (
            <section className="HeroSlideShow">
                {items.map((item, index) => {
                    const isActive = index === this.currentIndex

                    return (
                        <div
                            key={index}
                            className={isActive ? "HeroSlideShowItem HeroSlideShowItemActive" : "HeroSlideShowItem"}
                            style={{ transitionDuration: `${slideDuration}ms` }}
                        >
                            {/* Always mounted; only fetches once this slide has been active */}
                            <LazyImage alt={item.title} active={isActive} />

                            <div className="HeroSlideShowText">
                                <h2 className="HeroSlideShowTitle">{item.title}</h2>

                                {item.description && (
                                    <div className="HeroSlideShowDescription">{item.description}</div>
                                )}

                                {item.cta && (
                                    <button type="button" className="HeroSlideShowCta" onclick={() => item.cta?.(item)}>
                                        {item.ctaLabel ?? "Learn more"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}

                {count > 1 && (
                    <div className="HeroSlideShowControls">
                        <button
                            type="button"
                            className="HeroSlideShowArrow"
                            onclick={() => this.goTo(this.currentIndex - 1, count)}
                        >
                            ‹
                        </button>

                        <div className="HeroSlideShowDots">
                            {items.map((_, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    className={index === this.currentIndex ? "HeroSlideShowDot HeroSlideShowDotActive" : "HeroSlideShowDot"}
                                    onclick={() => this.goTo(index, count)}
                                />
                            ))}
                        </div>

                        <span className="HeroSlideShowCounter">
                            {this.currentIndex + 1} / {count}
                        </span>

                        <button
                            type="button"
                            className="HeroSlideShowArrow"
                            onclick={() => this.goTo(this.currentIndex + 1, count)}
                        >
                            ›
                        </button>
                    </div>
                )}
            </section>
        )
    }
}
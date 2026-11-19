import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import { LazyImage } from "@root/components/LazyImage/LazyImage"
import "./HeroSlideShow.scss"

export interface IHeroSlideShowItem {
    title: string
    description?: m.Children
    ctaLabel?: string
    cta?: (item: IHeroSlideShowItem) => void
}

export interface IHeroSlideShow {
    items: IHeroSlideShowItem[]
    initialOpen?: number
    fadeDuration?: number
}

export class HeroSlideShow extends MithrilTsxComponent<IHeroSlideShow> {
    private currentIndex = 0

    private goTo(index: number, count: number) {
        if (count === 0) return
        /*
        situatie: (0, 1*) en je klikt naar rechts:
        count = 2, index = 1 + 1 = 2, 
        (2 % 2) = 0; + 2 = 2; % 2 = 0 (Terug naar begin)

        //Loops around when extending past lower limit or upper limit
        */
        this.currentIndex = ((index % count) + count) % count
        //Eerste modulo zorgt voor te hoge getallen te clampen
        //+ count om negatieve getallen te voorkomen
        //dan nog een modulo nodig voor het geval dat er 0 uit de eerste modulo komt
        //en dan met count er dus over count - 1 gaat
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
                {items.map((item, index) => (
                    <div
                        key={index}
                        className={index === this.currentIndex ? "HeroSlideShowItem HeroSlideShowItemActive" : "HeroSlideShowItem"}
                        style={{ transitionDuration: `${slideDuration}ms` }}
                    >
                        {/* Only the shown slide has an image: it mounts (and loads) when you navigate to it */}
                        {index === this.currentIndex && <LazyImage alt={item.title} />}

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
                ))}

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
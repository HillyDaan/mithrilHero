import m from "mithril"
import { MithrilTsxComponent } from "mithril-tsx-component"
import { Link } from "@root/components/link"
import { HeroSlideShow, type IHeroSlideShowItem } from "@root/components/HeroSlideShow/HeroSlideShow"
import { HeroSlideShowPersistent } from "@root/components/HeroSlideShow/HeroSlideShowPersistent"
import { HeroSlideShowTransition } from "@root/components/HeroSlideShow/HeroSlideShowTransition"
import { HeroSlideShowTransitionV1 } from "@root/components/HeroSlideShow/HeroSlideShowTransitionV1"
import { HeroSlideShowMinimal, type IHeroSlideShowMinimalItem } from "@root/components/HeroSlideShow/HeroSlideShowMinimal"

/** Fixed picsum photos (by id), so URLs are stable and the browser cache works */
function picsum(id: number) {
  const url = (width: number) => `https://picsum.photos/id/${id}/${width}/${Math.round(width * 9 / 16)}`
  return { src: url(1600), srcset: `${url(800)} 800w, ${url(1600)} 1600w, ${url(2400)} 2400w` }
}

const minimalItems: IHeroSlideShowMinimalItem[] = [
  { title: 'Mountains', description: <p>First slide, a plain img on page load</p>, ...picsum(1018) },
  { title: 'Forest', description: <p>Preloaded while idle, so this swap is instant</p>, ...picsum(1043) },
  { title: 'Coast', description: <p>Jump here quickly to see the loading state</p>, ...picsum(1015) },
  { title: 'City', description: <p>Arrow keys and swiping work too</p>, ...picsum(1067) },
]
export interface IPage {
  id: string
}

const heroItems: IHeroSlideShowItem[] = [
  {
    title: 'firstSlide',
    description: <p> Helloo</p>,
    ctaLabel: 'Ghello learn more!'
  },
  {
    title: 'secondSlide',
    description: <p> Helloo</p>,
    ctaLabel: 'Ghello learn more!'
  },
  {
    title: 'thirdSlide',
    description: <p> Helloo</p>,
    ctaLabel: 'Ghello learn more!'
  }
]

export class Page extends MithrilTsxComponent<IPage> {
  private queueClicks = false

  view(v: m.Vnode<IPage>) {
    return <div className="stack">
      <HeroSlideShowPersistent items={heroItems}/>
      <label>
        <input type="checkbox" checked={this.queueClicks} onchange={(e: Event) => this.queueClicks = (e.target as HTMLInputElement).checked}/>
        {" "}Queue clicks
      </label>
      <HeroSlideShowTransitionV1 items={heroItems} queueClicks={this.queueClicks}/>
      <HeroSlideShowMinimal items={minimalItems} label="Minimal demo"/>
      <div>
        
        <Link className="btn-primary" href="/">Terug naar home</Link>
      </div>
    </div>
  }
}

import { HLTVConfig } from '../config'
import { HLTVScraper, type Cheerio } from '../scraper'  // 假設有 type 暴露
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsBlock {
  type: 'paragraph' | 'header' | 'image' | 'read-more' | string
  data: Record<string, any>
}

export interface NewsContent {
  id: number | string
  date: string
  title: string
  author: string
  body: {
    blocks: NewsBlock[]
  }
  image?: string
  event?: {
    name: string
    id?: number
  }
}

export const getNewsContent =
  (config: HLTVConfig) =>
  async ({ id }: { id: number | string }): Promise<NewsContent> => {
    const url = `https://www.hltv.org/news/${id}/${generateRandomSuffix()}`
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    const title = $('.headline').text().trim() || 'No title'

    const author = $('.author a').text().trim() || 'Unknown'

    const unix = $('.date').attr('data-unix')
    const date = unix ? new Date(Number(unix) * 1000).toISOString() : ''

    const mainImage = $('.image-con source, .image-con img')
      .first()
      .attr('srcset')?.split(' ')[0] || $('.image-con img').attr('src')

    const image = mainImage ? (mainImage.startsWith('//') ? `https:${mainImage}` : mainImage) : undefined

    const eventLink = $('.event a')
    const eventName = eventLink.text().trim()
    const eventHref = eventLink.attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined
    const event = eventName ? { name: eventName, id: eventId } : undefined

    // ───────────────────────────────────
    // 解析文章內容 → blocks
    // ───────────────────────────────────
    const blocks: NewsBlock[] = []

    const contentRoot = $('.newstext-con')

    // 處理開頭的描述文字（常見 class: headertext）
    const leadText = contentRoot.find('.headertext, p[itemprop="description"]').first().text().trim()
    if (leadText) {
      blocks.push({
        type: 'paragraph',
        data: { text: leadText }
      })
    }

    // 找所有 news-block 段落
    contentRoot.find('.news-block').each((_, el) => {
      const $el = $(el)
      const text = $el.text().trim()

      if (text) {
        blocks.push({
          type: 'paragraph',
          data: { text }
        })
      }
    })

    // 找可能的圖片（在 .newstext-con 內的 image-con）
    contentRoot.find('.image-con').each((_, el) => {
      const $el = $(el)

      let src = $el.find('source').attr('srcset')?.split(' ')[0]
      if (!src) src = $el.find('img').attr('src')

      if (src) {
        src = src.startsWith('//') ? `https:${src}` : src
        const alt = $el.find('img').attr('alt') || ''

        blocks.push({
          type: 'image',
          data: {
            src,
            alt
          }
        })
      }
    })

    // 找 read more 連結
    contentRoot.find('.news-read-more-1').each((_, el) => {
      const $el = $(el)
      const text = $el.find('.news-read-more-1-bottom').text().trim()
      let href = $el.attr('href')

      if (!href) href = $el.find('a').attr('href')

      if (text && href) {
        if (href.startsWith('/')) href = `https://www.hltv.org${href}`

        blocks.push({
          type: 'read-more',
          data: {
            text,
            url: href
          }
        })
      }
    })

    // 如果沒有抓到任何 news-block，fallback 抓所有 p
    if (blocks.filter(b => b.type === 'paragraph').length === 0) {
      contentRoot.find('p').each((_, el) => {
        const text = $(el).text().trim()
        if (text && text.length > 15) {  // 避免抓到很短的雜訊
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
      })
    }

    return {
      id,
      date,
      title,
      author,
      body: {
        blocks
      },
      image,
      event
    }
  }

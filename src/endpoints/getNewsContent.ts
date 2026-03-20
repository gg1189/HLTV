import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string                    // ISO format, e.g. "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  body: {
    blocks: Array<
      | {
          type: 'paragraph' | 'header'
          data: {
            text: string
          }
        }
      | {
          type: 'image'
          data: {
            url: string
            alt?: string
          }
        }
    >
  }
  image_url?: string              // 可選：保留原本的主要封面圖（如果需要）
  event?: {
    name: string
    id?: number
  }
}

export const getNewsContent =
  (config: HLTVConfig) =>
  async ({ id }: { id: number | string }): Promise<NewsContent> => {
    const url = `https://www.hltv.org/news/${id}/${generateRandomSuffix()}`
    const html = await fetchPage(url, config.loadPage)
    const $ = HLTVScraper(html)

    // Title
    const title = $('h1.headline').trimText() || 'No title'

    // Author
    const author = $('.author-date-con .author a').trimText() || 'Unknown author'

    // Date
    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString()

    // 主圖（原本的 image_url，可選保留）
    let image_url: string | undefined
    const srcsetMain = $('.image-con picture source').attr('srcset')
    if (srcsetMain) {
      image_url = srcsetMain.split(',')[0]?.trim().split(' ')[0]
    }

    // Event
    const eventName = $('.event a').trimText()
    const eventHref = $('.event a').attr('href')
    let eventId: number | undefined
    if (eventHref) {
      const match = eventHref.match(/\/events\/(\d+)/)
      eventId = match ? Number(match[1]) : undefined
    }

    // ── 提取 blocks ──（嚴格按原始 HTML 順序）
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      contentContainer.children().each((i, el) => {

        const className = el.attr('class') || ''

        // headertext → header
        if (className.includes('headertext')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'header',
              data: { text }
            })
          }
        }

        // news-block → paragraph
        else if (className.includes('news-block')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'paragraph',
              data: { text }
            })
          }
        }

        // image-con → image block
        else if (className.includes('image-con')) {
          // 優先取 <source srcset> 的第一個 URL
          let imgUrl = el.find('picture source').attr('srcset')?.split(',')[0]?.trim().split(' ')[0]

          // 如果沒有 source，就取 <img src>
          if (!imgUrl) {
            imgUrl = el.find('img.image').attr('src')
          }

          // 取 alt（如果有）
          const alt = el.find('img.image').attr('alt') || el.find('img').attr('title') || undefined

          if (imgUrl) {
            blocks.push({
              type: 'image',
              data: {
                url: imgUrl,
                alt
              }
            })
          }
        }

        // 其他元素（如 .news-read-more-1）目前忽略
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
      image_url,  // 可選保留主圖
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string                    // ISO format, e.g. "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  body: {
    blocks: Array<{
      type: 'paragraph' | 'header' | 'image'
      data: {
        text?: string
        url?: string
      }
    }>
  }
  image_url?: string
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

    // 主圖（保留原本邏輯）
    let image_url: string | undefined
    const srcset = $('.image-con picture source').attr('srcset')
    if (srcset) {
      image_url = srcset.split(',')[0]?.trim().split(' ')[0]
    }

    // Event
    const eventName = $('.event a').trimText()
    const eventHref = $('.event a').attr('href')
    let eventId: number | undefined
    if (eventHref) {
      const match = eventHref.match(/\/events\/(\d+)/)
      eventId = match ? Number(match[1]) : undefined
    }

    // ── 提取 blocks ──
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // 按原始 DOM 順序遍歷所有直接子元素
      contentContainer.children().each((i, el) => {
        const $el = $(el)  // 包裝成 HLTVPageElement 才能用 trimText() 等方法

        if ($el.hasClass('headertext')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'header',
              data: { text }
            })
          }
        }
        else if ($el.hasClass('image-con')) {
          const imgSrc = $el.find('img').attr('src')
          if (imgSrc) {
            blocks.push({
              type: 'image',
              data: { url: imgSrc }
            })
          }
        }
        else if ($el.hasClass('news-block')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'paragraph',
              data: { text }
            })
          }
        }
        // 其他子元素（如 .news-read-more-1）直接忽略
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
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

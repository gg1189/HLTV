import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string                    // ISO format, e.g. "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  content: string                 // optional: plain text fallback
  body?: {
    blocks: Array<{
      type: 'paragraph' | 'header'
      data: {
        text: string
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

    // Date (data-unix usually in seconds)
    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString()

    // ────────────────────────────────────────────────
    // 核心改進：直接從 DOM 結構產生 blocks
    // ────────────────────────────────────────────────
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // 處理所有直接子元素，根據 class 決定類型
      contentContainer.children().each((i, el) => {
        const $el = $(el)

        const text = $el.trimText()
        if (!text) return  // 跳過空內容

        let type: 'paragraph' | 'header' = 'paragraph'

        // 根據 class 或特徵判斷
        if ($el.hasClass('headertext') || $el.hasClass('newstext-header')) {
          type = 'header'
        } else if ($el.hasClass('news-block')) {
          type = 'paragraph'
        } else if (
          // 額外 heuristic：短內容 + 看起來像標題
          text.length < 80 &&
          (text === text.toUpperCase() ||
            text.includes('Update') ||
            text.includes('New') ||
            text.includes('Change') ||
            text.endsWith(':'))
        ) {
          type = 'header'
        }

        blocks.push({
          type,
          data: { text }
        })
      })
    }

    // 產生純文字版本（可選，方便 debug 或相容舊系統）
    const plainContent = blocks
      .map(b => b.data.text)
      .join('\n\n')
      .trim()

    // Image
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

    return {
      id,
      date,
      title,
      author,
      content: plainContent || 'No content available',
      body: blocks.length > 0 ? { blocks } : undefined,
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

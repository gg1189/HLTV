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
    const dateUnixRaw = $('.date').attr('data-unix')
    const dateUnix = dateUnixRaw ? parseInt(dateUnixRaw, 10) : NaN
    const date = !isNaN(dateUnix) && dateUnix > 0
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString()

    // 主圖（封面圖）
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

    // ── Debug logs ──
    console.log(`[getNewsContent] News ID: ${id}`)
    console.log(`[getNewsContent] URL: ${url}`)
    console.log(`[getNewsContent] Container exists: ${$('.newstext-con').exists()}`)
    console.log(`[getNewsContent] Found .newsdsl .newstext-con: ${$('.newsdsl .newstext-con').exists()}`)
    console.log(`[getNewsContent] Number of direct children in .newstext-con: ${$('.newstext-con').children().length}`)

    // 列出所有直接子元素的 class（最重要的 debug 資訊）
    const childClasses = $('.newstext-con').children().map((i, el) => {
      const className = $(el).attr('class') || '(no class)'
      const tag = el.tagName.toLowerCase()
      return `${tag}.${className}`
    }).toArray()
    console.log('[getNewsContent] Direct children classes:', childClasses)

    // 提取 blocks（按原始順序）
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newstext-con').first()  // 改用更寬鬆的選擇器

    if (contentContainer.exists()) {
      contentContainer.children().each((i, el) => {
        const el = $(el)
        const className = el.attr('class') || ''
        const text = el.trimText()

        if (className.includes('headertext')) {
          if (text) {
            blocks.push({ type: 'header', data: { text } })
          }
        } else if (className.includes('news-block')) {
          if (text) {
            blocks.push({ type: 'paragraph', data: { text } })
          }
        } else if (className.includes('image-con')) {
          let imgUrl = el.find('picture source').attr('srcset')?.split(',')[0]?.trim().split(' ')[0]
          if (!imgUrl) {
            imgUrl = el.find('img').attr('src')
          }
          const alt = el.find('img').attr('alt') || el.find('img').attr('title') || undefined
          if (imgUrl) {
            blocks.push({
              type: 'image',
              data: { url: imgUrl, alt }
            })
          }
        }
      })
    }

    console.log(`[getNewsContent] Generated blocks count: ${blocks.length}`)

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

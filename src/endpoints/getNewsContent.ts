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

    // Date (data-unix 通常是秒級 timestamp)
    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString() // fallback to current time

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

    // ── 提取 blocks ──
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // .headertext → header block
      contentContainer.children('.headertext').each((i, el) => {
        const text = el.trimText()
        if (text) {
          blocks.push({
            type: 'header',
            data: { text }
          })
        }
      })

      // .headertext → header block
      contentContainer.children('.image-con').each((i, el) => {
      const imgSrc = $child.find('img').attr('src')
          if (imgSrc) {
            blocks.push({
              type: 'image',
              data: { url: imgSrc }
            })
        }
      })

      // .news-block → paragraph block
      contentContainer.children('.news-block').each((i, el) => {
        const text = el.trimText()
        if (text) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
      })
    }

    // 如果沒有任何 block，blocks 會保持為空陣列

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

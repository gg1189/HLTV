import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string
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

    const title = $('h1.headline').trimText() || 'No title'
    const author = $('.author-date-con .author a').trimText() || 'Unknown author'

    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString()

    let image_url: string | undefined
    const srcset = $('.image-con picture source').attr('srcset')
    if (srcset) {
      image_url = srcset.split(',')[0]?.trim().split(' ')[0]
    }

    const eventName = $('.event a').trimText()
    const eventHref = $('.event a').attr('href')
    let eventId: number | undefined
    if (eventHref) {
      const match = eventHref.match(/\/events\/(\d+)/)
      eventId = match ? Number(match[1]) : undefined
    }

    // ── 提取 blocks ── 使用順序 push
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      contentContainer.children().each((i, el) => {
        const el = $(el)
        const text = el.trimText()

        if (!text) return

        if (el.hasClass('headertext')) {
          blocks.push({
            type: 'header',
            data: { text }
          })
        } else if (el.hasClass('news-block')) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
        // 可擴展其他類型，例如：
        // else if (el.hasClass('image-con')) { ... }
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

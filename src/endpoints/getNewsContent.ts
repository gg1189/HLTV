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

    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      contentContainer.children().each((i, el) => {
        // el 就是 HLTVPageElement，可以直接用 .hasClass()、.trimText()、.find() 等

        if (el.hasClass('headertext')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'header',
              data: { text }
            })
          }
        }
        else if (el.hasClass('image-con')) {
          const imgSrc = el.find('img').attr('src')
          if (imgSrc) {
            blocks.push({
              type: 'image',
              data: { url: imgSrc }
            })
          }
        }
        else if (el.hasClass('news-block')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'paragraph',
              data: { text }
            })
          }
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
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

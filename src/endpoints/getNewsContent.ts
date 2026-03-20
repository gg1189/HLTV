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
      | { type: 'paragraph'; data: { text: string } }
      | { type: 'header';    data: { text: string } }
      | { type: 'image';     data: { url: string; alt?: string } }
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

    // Date (data-unix is usually seconds)
    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString()

    // Main featured image (optional - first image in .image-con)
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

    // ── Build blocks in DOM order ──
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // Iterate over all direct children to preserve exact order
      contentContainer.children().each((i, child) => {

        const text = child.trimText()
        const classAttr = child.attr('class') || ''

        if (classAttr.includes('headertext') && text) {
          blocks.push({
            type: 'header',
            data: { text }
          })
        }
        else if (classAttr.includes('news-block') && text) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
        else if (classAttr.includes('image-con')) {
          // Extract best available image URL
          let imgUrl =
            child.find('img').attr('src') ||
            child.find('source').attr('srcset')?.split(',')[0]?.trim().split(' ')[0]

          if (imgUrl) {
            blocks.push({
              type: 'image',
              data: {
                url: imgUrl,
                alt: child.find('img').attr('alt') || undefined
              }
            })
          }
        }
        // <a class="news-read-more-1"> will be skipped automatically
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

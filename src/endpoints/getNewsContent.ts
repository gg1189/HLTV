import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPasge, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string                    // ISO format, e.g. "2025-03-19T08:38:00.000Z"
  title: string
  author: string
  content: string                 // clean text content with paragraphs separated by \n\n
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

    // Date (data-unix is usually seconds → convert to ms)
    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString() // fallback to now if missing

    // Content: extract clean text from .newstext-con
    let content = ''
    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // Optional header/summary (sometimes present as .headertext)
      const headerText = contentContainer.children('.headertext').first().trimText()
      if (headerText) {
        content += headerText + '\n\n'
      }

      // Main paragraphs (usually .news-block)
      const paragraphs = contentContainer.children('.news-block').toArray()

      paragraphs.forEach((p) => {
        const text = p.trimText()
        if (text) {
          content += text + '\n\n'
        }
      })

      // Clean up trailing newlines
      content = content.trim()
    }

    // If no useful content was found, fallback to raw HTML (rare)
    if (!content) {
      content = contentContainer.html()?.trim() || 'No content available'
    }

    // Image (take first source from srcset)
    let image_url: string | undefined
    const srcset = $('.image-con picture source').attr('srcset')
    if (srcset) {
      // srcset example: "url1 1x, url2 2x" → take first URL
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
      content,
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined,
    }
  }

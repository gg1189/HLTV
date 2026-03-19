import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  title: string
  author: string
  date: string  // ISO 格式，例如 "2026-03-19T08:38:00.000Z"
  content: string
  image_url?: string
  event?: {
    name: string
    id: number
  }
}

export const getNewsContent =
  (config: HLTVConfig) => async ({ id }: { id: number | string }): Promise<NewsContent> => {
    // 加 generateRandomSuffix() 避免重複請求被擋
    const url = `https://www.hltv.org/news/${id}/${generateRandomSuffix()}`
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    const title = $('h1.headline').text().trim()

    const author = $('.author-date-con .author a').text().trim() || 'Unknown'

    const dateText = $('.date').attr('data-unix')
    const date = dateText ? new Date(Number(dateText)).toISOString() : ''

    const content = $('.newsdsl .newstext-con').html() || ''

    const image_url = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined

    return {
      id,
      date,
      title,
      author,
      content,
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

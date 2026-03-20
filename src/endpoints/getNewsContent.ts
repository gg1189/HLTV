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
      type: 'paragraph' | 'header' | 'image'
      data: {
        text?: string          // for paragraph/header
        url?: string           // for image
      }
    }>
  }
  image_url?: string           // 保留原主圖（可選，如果有頭圖）
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

    // 主圖（如果新聞有頭圖，可保留）
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

    // ── 提取 blocks，按原始順序 ──
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // 抓所有相關的直接子元素（p.headertext, p.news-block, div.image-con）
      const relevantChildren = contentContainer.children().toArray()

            blocks.push({
              type: 'image',
              data: { url: relevantChildren }
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
      image_url,  // 如果有頭圖，可保留；或設為 undefined
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

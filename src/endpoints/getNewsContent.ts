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
        text?: string          // for paragraph/header
        url?: string           // for image
      }
    }>
  }
  image_url?: string             // 原有的主要圖片（可選保留）
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
      : new Date().toISOString() // fallback

    // 原有主要圖片（可選保留，如果你之後還想用）
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
      // 遍歷所有直接子元素，按順序處理
      contentContainer.children().each((i, child) => {
        const $child = $(child)  // 用 wrapper 包裝

        // 處理 .headertext
        if ($child.hasClass('headertext')) {
          const text = $child.trimText()
          if (text) {
            blocks.push({
              type: 'header',
              data: { text }
            })
          }
        }

        // 處理 .image-con → 取出 <img src>
        else if ($child.hasClass('image-con')) {
          const imgSrc = $child.find('img').attr('src')
          if (imgSrc) {
            blocks.push({
              type: 'image',
              data: { url: imgSrc }
            })
          }
        }

        // 處理 .news-block
        else if ($child.hasClass('news-block')) {
          const text = $child.trimText()
          if (text) {
            blocks.push({
              type: 'paragraph',
              data: { text }
            })
          }
        }

        // 忽略其他子元素（如 <a class="news-read-more-1"> 等）
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
      image_url,  // 可選保留，如果你前端還需要單獨處理主要圖片
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

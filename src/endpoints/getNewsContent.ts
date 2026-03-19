import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string                    // ISO 格式，例如 "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  body: {
    blocks: Array<{
      data: {
        text: string
      }
      type: 'paragraph' | 'header' | 'image' | string  // 可擴充其他 type
    }>
  }
  image_url?: string
  event?: {
    name: string
    id?: number
  }
}

export const getNewsContent =
  (config: HLTVConfig) => async ({ id }: { id: number | string }): Promise<NewsContent> => {
    const url = `https://www.hltv.org/news/${id}/${generateRandomSuffix()}`
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    const title = $('h1.headline').text().trim() || '無標題'

    const author = $('.author-date-con .author a').text().trim() || '未知作者'

    const dateText = $('.date').attr('data-unix')
    const date = dateText ? new Date(Number(dateText)).toISOString() : ''

    const image_url = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventIdMatch = eventHref?.match(/\/events\/(\d+)/)
    const eventId = eventIdMatch ? Number(eventIdMatch[1]) : undefined

    // 提取內容並轉成 blocks 格式
    const bodyBlocks: NewsContent['body']['blocks'] = []

    // 標題作為第一個 header block
    bodyBlocks.push({
      data: { text: title },
      type: 'header'
    })

    // 處理 .newstext-con 裡的所有 p 元素
    $('.newsdsl .newstext-con p').each((_, el) => {
      const text = $(el).text().trim()
      if (text) {
        bodyBlocks.push({
          data: { text },
          type: 'paragraph'
        })
      }
    })

    // 如果有圖片，作為 image block（可擴充）
    if (image_url) {
      bodyBlocks.push({
        data: { text: image_url },
        type: 'image'
      })
    }

    return {
      id,
      date,
      title,
      author,
      body: {
        blocks: bodyBlocks
      },
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

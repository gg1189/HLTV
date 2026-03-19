import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsBlock {
  type: 'paragraph' | 'header'
  data: {
    text: string
  }
}

export interface NewsContent {
  id: string | number
  date: string                    // ISO 格式，例如 "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  body: {
    blocks: NewsBlock[]
  }
  image_url?: string
  event?: {
    name: string
    id?: number
  }
}

export const getNewsContent =
  (config: HLTVConfig) => async ({ id }: { id: number | string }): Promise<NewsContent> => {
    // 加 generateRandomSuffix() 避免重複請求被擋
    const url = `https://www.hltv.org/news/${id}/${generateRandomSuffix()}`
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    const title = $('h1.headline').text().trim() || '無標題'

    const author = $('.author-date-con .author a').text().trim() || '未知作者'

    const dateText = $('.date').attr('data-unix')
    const date = dateText ? new Date(Number(dateText)).toISOString() : ''

    const image_url = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined

    // 提取新聞正文內容，並轉換成 blocks 結構
    const blocks: NewsBlock[] = []
    const contentElements = $('.newsdsl .newstext-con').children()

    contentElements.each((_, el) => {
      const $el = $(el)

      // 標題（h2, h3, strong 等）
      if ($el.is('h1, h2, h3, h4, strong, .headertext')) {
        blocks.push({
          type: 'header',
          data: { text: $el.text().trim() }
        })
      }
      // 段落（p, div.news-block）
      else if ($el.is('p, div.news-block')) {
        const text = $el.text().trim()
        if (text) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
      }
      // 其他元素（如圖片、連結）可再擴充
    })

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

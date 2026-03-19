import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsBlock {
  type: 'paragraph' | 'image' | 'header'
  data: {
    text?: string
    url?: string
    level?: number  // 如果是 header
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

    // 抓取內容並轉成 blocks 結構
    const blocks: NewsBlock[] = []

    // 遍歷 .newstext-con 裡的所有 p、img、h 等元素
    $('.newsdsl .newstext-con').children().each((_, el) => {
      const $el = $(el)

      if ($el.is('p')) {
        const text = $el.text().trim()
        if (text) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
      } else if ($el.is('img') || $el.is('picture') || $el.is('figure')) {
        const imgSrc = $el.find('img').attr('src') || $el.attr('src') || $el.find('source').attr('srcset')?.split(' ')[0]
        if (imgSrc) {
          blocks.push({
            type: 'image',
            data: { url: imgSrc }
          })
        }
      } else if ($el.is('h1, h2, h3, h4, h5, h6')) {
        const level = Number($el.prop('tagName').replace('H', ''))
        const text = $el.text().trim()
        if (text) {
          blocks.push({
            type: 'header',
            data: { text, level }
          })
        }
      }
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

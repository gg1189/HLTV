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
        text?: string
        url?: string
        src?: string
        alt?: string
      }
      type: 'header' | 'paragraph' | 'image' | 'read-more' | 'other'
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

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined

    const image_url = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    // 提取 body blocks（跟 browser console 測試完全一樣的邏輯）
    const blocks: NewsContent['body']['blocks'] = []

    $('.newstext-con').children().each((_, el) => {
      const $el = $(el)
      const tag = $el.prop('tagName').toLowerCase()
      const className = $el.attr('class') || ''

      let block: NewsContent['body']['blocks'][number] | null = null

      // Header（p.headertext 或 h1/h2/h3）
      if ((tag === 'p' && className.includes('headertext')) || ['h1', 'h2', 'h3'].includes(tag)) {
        block = {
          data: { text: $el.text().trim() },
          type: 'header'
        }
      }

      // Paragraph（p.news-block 或一般 p）
      else if (tag === 'p') {
        block = {
          data: { text: $el.text().trim() },
          type: 'paragraph'
        }
      }

      // Image（div.image-con）
      else if (className.includes('image-con') || $el.find('img').length > 0) {
        const imgSrc = $el.find('img').attr('src') || $el.find('source').attr('srcset')?.split(' ')[0]
        if (imgSrc) {
          block = {
            data: {
              src: imgSrc,
              alt: $el.find('img').attr('alt') || ''
            },
            type: 'image'
          }
        }
      }

      // Read more link（a.news-read-more-1）
      else if (className.includes('news-read-more-1') || (tag === 'a' && className.includes('news-read-more'))) {
        const linkText = $el.find('.news-read-more-1-bottom').text().trim() || 'Read more'
        const linkUrl = $el.attr('href') || ''
        block = {
          data: {
            text: linkText,
            url: linkUrl
          },
          type: 'read-more'
        }
      }

      // 其他元素（div、span 等）
      else {
        block = {
          data: { text: $el.text().trim() },
          type: 'other'
        }
      }

      if (block) {
        blocks.push(block)
      }
    })

    return {
      id,
      date,
      title,
      author,
      body: { blocks },
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

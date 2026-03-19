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
    
    let html: string
    try {
      html = await fetchPage(url, config.loadPage)
      if (!html || typeof html !== 'string' || html.trim() === '') {
        throw new Error('fetchPage 回傳無效 HTML（空或非字串）')
      }
    } catch (err) {
      console.error('fetchPage 失敗:', err)
      throw new Error(`無法載入新聞頁面: ${err.message}`)
    }

    let $
    try {
      $ = HLTVScraper(html)
    } catch (err) {
      console.error('HLTVScraper 錯誤:', err)
      throw new Error(`cheerio 解析失敗: ${err.message}`)
    }

    // 以下保持原邏輯，但加防呆
    const title = $('h1.headline').text().trim() || '無標題'
    const author = $('.author-date-con .author a').text().trim() || '未知作者'
    const dateText = $('.date').attr('data-unix')
    const date = dateText ? new Date(Number(dateText)).toISOString() : ''
    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined
    const image_url = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    // blocks 提取（已確認在 browser console 成功）
    const blocks: NewsContent['body']['blocks'] = []

    $('.newstext-con').children().each((_, el) => {
      const $el = $(el)
      const tag = $el.prop('tagName').toLowerCase()
      const className = $el.attr('class') || ''

      let block: NewsContent['body']['blocks'][number] | null = null

      if ((tag === 'p' && className.includes('headertext')) || ['h1', 'h2', 'h3'].includes(tag)) {
        block = {
          data: { text: $el.text().trim() },
          type: 'header'
        }
      } else if (tag === 'p') {
        block = {
          data: { text: $el.text().trim() },
          type: 'paragraph'
        }
      } else if (className.includes('image-con') || $el.find('img').length > 0) {
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
      } else if (className.includes('news-read-more-1') || (tag === 'a' && className.includes('news-read-more'))) {
        const linkText = $el.find('.news-read-more-1-bottom').text().trim() || 'Read more'
        const linkUrl = $el.attr('href') || ''
        block = {
          data: {
            text: linkText,
            url: linkUrl
          },
          type: 'read-more'
        }
      } else {
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

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
        image_url?: string
        link?: string
        title?: string
      }
      type: 'paragraph' | 'header' | 'image' | 'read-more' | 'other'
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

    const author = $('.author-date-con .author a').attr('textContent')?.trim() || '未知作者'

    const dateText = $('.date').attr('data-unix')
    const date = dateText ? new Date(Number(dateText)).toISOString() : ''

    const image_url = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined

    // 動態生成 blocks，從 .newstext-con 的子元素
    const blocks: NewsContent['body']['blocks'] = []

    $('.newstext-con').children().each((_, child) => {
      const tag = child.attr('tagName')?.toLowerCase() || ''
      const className = child.attr('class') || ''

      let block: NewsContent['body']['blocks'][number] = {
        data: {},
        type: 'other'
      }

      if (tag === 'p') {
        block = {
          data: { text: child.text().trim() },
          type: 'paragraph'
        }
      } else if (tag.match(/^h[1-6]$/)) {
        block = {
          data: { text: child.text().trim() },
          type: 'header'
        }
      } else if (className.includes('image-con')) {
        const imgSrc = child.find('img').attr('src') || child.find('source').attr('srcset')?.split(' ')[0]
        block = {
          data: { image_url: imgSrc },
          type: 'image'
        }
      } else if (className.includes('news-read-more-1')) {
        const readMoreTitle = child.find('.news-read-more-1-bottom').text().trim()
        const readMoreLink = child.attr('href')
        block = {
          data: {
            text: child.find('.news-read-more-1-top').text().trim() || 'Read more',
            title: readMoreTitle,
            link: readMoreLink
          },
          type: 'read-more'
        }
      } else if (child.text().trim()) {
        block = {
          data: { text: child.text().trim() },
          type: 'other'
        }
      }

      if (Object.keys(block.data).length > 0) {
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

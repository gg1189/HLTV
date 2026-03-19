import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string                    // ISO 格式，例如 "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  body: {
    blocks: Block[]
  }
  image_url?: string
  event?: {
    name: string
    id?: number
  }
}

type BlockType = 'paragraph' | 'header' | 'image' | 'read-more'

interface Block {
  type: BlockType
  data: {
    text?: string
    image_url?: string
    link?: string
    link_text?: string
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

    const mainImage = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined

    // 提取 .newstext-con 裡的所有主要元素，轉成 blocks
    const blocks: Block[] = []

    $('.newstext-con')
      .children()
      .each((i, el) => {
        const $el = $(el)

        if ($el.is('p.headertext')) {
          blocks.push({
            type: 'header',
            data: { text: $el.text().trim() }
          })
        } else if ($el.is('p.news-block')) {
          blocks.push({
            type: 'paragraph',
            data: { text: $el.text().trim() }
          })
        } else if ($el.is('div.image-con')) {
          const imgSrc = $el.find('img').attr('src') || $el.find('source').attr('srcset')?.split(' ')[0]
          if (imgSrc) {
            blocks.push({
              type: 'image',
              data: { image_url: imgSrc }
            })
          }
        } else if ($el.is('a.news-read-more-1')) {
          const link = $el.attr('href') || ''
          const linkText = $el.find('.news-read-more-1-bottom').text().trim()
          blocks.push({
            type: 'read-more',
            data: {
              link,
              link_text: linkText,
              text: $el.find('.news-read-more-1-top').text().trim()
            }
          })
        }
        // 可以繼續加其他類型，如 blockquote、ul 等
      })

    return {
      id,
      date,
      title,
      author,
      body: { blocks },
      image_url: mainImage,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

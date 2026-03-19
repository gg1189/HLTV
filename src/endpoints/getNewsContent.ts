import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsBlock {
  type: 'paragraph' | 'header' | 'image' | 'read-more' | 'other'
  data: {
    text?: string
    image_url?: string
    link?: string
    readMoreTitle?: string
    readMoreDescription?: string
    [key: string]: any
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

    const mainImage = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined

    // 提取 newstext-con 內的所有 block
    const blocks: NewsBlock[] = []

    $('.newsdsl .newstext-con')
      .children()
      .each((_, child) => {
        const $child = $(child)
        const tag = $child.prop('tagName').toLowerCase()

        if (tag === 'p') {
          const text = $child.text().trim()
          if (text) {
            blocks.push({
              type: $child.hasClass('headertext') ? 'header' : 'paragraph',
              data: { text }
            })
          }
        } else if (tag === 'div' && $child.hasClass('image-con')) {
          const imgSrc = $child.find('img').attr('src') || $child.find('source').attr('srcset')?.split(' ')[0]
          if (imgSrc) {
            blocks.push({
              type: 'image',
              data: { image_url: imgSrc }
            })
          }
        } else if (tag === 'a' && $child.hasClass('news-read-more-1')) {
          const readMoreTitle = $child.find('.news-read-more-1-bottom').text().trim()
          const readMoreDescription = $child.find('.news-read-more-1-top').text().trim()
          const readMoreLink = $child.attr('href')

          blocks.push({
            type: 'read-more',
            data: {
              link: readMoreLink,
              readMoreTitle,
              readMoreDescription
            }
          })
        } else {
          // 其他元素（如 div 內嵌其他內容）可視情況處理
          const text = $child.text().trim()
          if (text) {
            blocks.push({
              type: 'other',
              data: { text }
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
      image_url: mainImage,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

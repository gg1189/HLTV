import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsBlock {
  type: 'header' | 'paragraph' | 'image' | 'video' | 'list' | 'link' | 'table'
  data: {
    text?: string
    url?: string
    level?: number
    items?: string[]          // for list
    src?: string              // for video
  }
}

export interface NewsContent {
  id: string | number
  date: string                    // ISO 格式
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

    // 解析 body blocks
    const blocks: NewsBlock[] = []

    $('.newsdsl .newstext-con').children().each((_, el) => {
      const $el = $(el)

      // headertext → header
      if ($el.is('p') && $el.hasClass('headertext')) {
        const text = $el.text().trim()
        if (text) {
          blocks.push({ type: 'header', data: { text, level: 2 } })
        }
      }
      // 普通段落
      else if ($el.is('p') && $el.hasClass('news-block')) {
        const text = $el.text().trim()
        if (text) {
          blocks.push({ type: 'paragraph', data: { text } })
        }
      }
      // 圖片
      else if ($el.is('img, picture, figure, .image-con')) {
        let imgSrc = $el.find('img').attr('src') || $el.attr('src') || $el.find('source').attr('srcset')?.split(' ')[0]
        if (imgSrc) {
          blocks.push({ type: 'image', data: { url: imgSrc } })
        }
      }
      // 影片 (iframe)
      else if ($el.is('.videoCon iframe')) {
        const src = $el.attr('src')
        if (src) {
          blocks.push({ type: 'video', data: { src } })
        }
      }
      // 清單
      else if ($el.is('ul')) {
        const items: string[] = []
        $el.find('li').each((_, li) => {
          const text = $(li).text().trim()
          if (text) items.push(text)
        })
        if (items.length) {
          blocks.push({ type: 'list', data: { items } })
        }
      }
      // 表格
      else if ($el.is('table')) {
        blocks.push({ type: 'table', data: { text: $el.html() || '' } })
      }
      // 連結區塊 (news-read-more)
      else if ($el.is('.news-read-more-1')) {
        const linkText = $el.find('.news-read-more-1-bottom').text().trim()
        const linkHref = $el.attr('href')
        if (linkText && linkHref) {
          blocks.push({
            type: 'link',
            data: { text: linkText, url: linkHref }
          })
        }
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

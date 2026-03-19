import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsBlock {
  type: 'header' | 'paragraph' | 'image' | 'video' | 'list' | 'html'
  data: {
    text?: string
    url?: string
    level?: number
    html?: string
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

    // 安全處理 blocks（解決 Unexpected type of selector）
    const blocks: NewsBlock[] = []
    const container = $('.newsdsl .newstext-con')

    container.find('p.headertext, p.news-block, .image-con, .videoCon, table, ul').each((_, el) => {
      const $el = $(el)
      const text = $el.text().trim()

      // headertext → header
      if ($el.hasClass('headertext') && text) {
        blocks.push({ type: 'header', data: { text, level: 2 } })
      }
      // 普通段落
      else if ($el.is('p.news-block') && text) {
        blocks.push({ type: 'paragraph', data: { text } })
      }
      // 圖片
      else if ($el.hasClass('image-con') || $el.is('img, picture, figure')) {
        const imgSrc = $el.find('img').attr('src') || $el.attr('src') || $el.find('source').attr('srcset')?.split(' ')[0]
        if (imgSrc) blocks.push({ type: 'image', data: { url: imgSrc } })
      }
      // 影片
      else if ($el.hasClass('videoCon')) {
        const videoUrl = $el.find('iframe').attr('src')
        if (videoUrl) blocks.push({ type: 'video', data: { url: videoUrl } })
      }
      // 清單
      else if ($el.is('ul')) {
        const listItems = $el.find('li').map((_, li) => $(li).text().trim()).get().join('\n')
        if (listItems) blocks.push({ type: 'list', data: { text: listItems } })
      }
      // 表格（保留完整 HTML）
      else if ($el.is('table')) {
        blocks.push({ type: 'html', data: { html: $el.html() || '' } })
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

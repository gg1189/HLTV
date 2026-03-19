import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsBlock {
  type: 'header' | 'paragraph' | 'image' | 'video' | 'list' | 'table' | 'html'
  data: {
    text?: string
    url?: string
    level?: number
    html?: string
  }
}

export interface NewsContent {
  id: string | number
  date: string
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
    let $: cheerio.Root

    try {
      $ = HLTVScraper(await fetchPage(url, config.loadPage))
    } catch (err) {
      throw new Error(`頁面載入失敗: ${err.message}`)
    }

    const title = $('h1.headline').text().trim() || '無標題'

    const author = $('.author-date-con .author a').text().trim() || '未知作者'

    const dateText = $('.date').attr('data-unix')
    const date = dateText ? new Date(Number(dateText)).toISOString() : ''

    const image_url = $('.image-con picture source, .image-con img').attr('srcset')?.split(' ')[0] ||
                      $('.image-con img').attr('src') || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined

    // 安全處理 blocks
    const blocks: NewsBlock[] = []
    const container = $('.newsdsl .newstext-con')

    if (!container.length) {
      blocks.push({
        type: 'paragraph',
        data: { text: '內容無法提取，請檢查新聞 ID 或頁面結構' }
      })
    } else {
      container.contents().each((_, el) => {
        const $el = $(el)

        if ($el.is('p')) {
          const text = $el.text().trim()
          if (text) {
            if ($el.hasClass('headertext')) {
              blocks.push({
                type: 'header',
                data: { text, level: 2 }
              })
            } else {
              blocks.push({
                type: 'paragraph',
                data: { text }
              })
            }
          }
        } else if ($el.is('img, picture, figure')) {
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
        } else if ($el.is('ul, ol')) {
          const items = $el.find('li').map((_, li) => $(li).text().trim()).get()
          if (items.length) {
            blocks.push({
              type: 'list',
              data: { text: items.join('\n') }
            })
          }
        } else if ($el.is('table')) {
          blocks.push({
            type: 'table',
            data: { html: $el.html() || '' }
          })
        } else if ($el.is('div.videoCon, iframe')) {
          const videoUrl = $el.find('iframe').attr('src') || $el.attr('src')
          if (videoUrl) {
            blocks.push({
              type: 'video',
              data: { url: videoUrl }
            })
          }
        }
      })
    }

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

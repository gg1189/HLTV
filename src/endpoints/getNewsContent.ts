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
  error?: string                  // debug 用
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
    console.log(`[DEBUG] 抓取新聞 URL: ${url}`)

    try {
      const html = await fetchPage(url, config.loadPage)
      console.log(`[DEBUG] HTML 長度: ${html.length} 字元`)

      // 修正：html 是 string，先 log 前 500 字
      console.log('[DEBUG] HTML 前 500 字:', html.substring(0, 500))

      const $ = HLTVScraper(html)

      const title = $('h1.headline').text().trim() || '無標題'
      console.log('[DEBUG] 標題:', title)

      const author = $('.author-date-con .author a').text().trim() || '未知作者'
      console.log('[DEBUG] 作者:', author)

      const dateText = $('.date').attr('data-unix')
      const date = dateText ? new Date(Number(dateText)).toISOString() : ''
      console.log('[DEBUG] 日期 (unix):', dateText, '→ ISO:', date)

      const mainImage = $('.image-con picture source').attr('srcset')?.split(' ')[0] || undefined
      console.log('[DEBUG] 主圖:', mainImage)

      const eventName = $('.event a').text().trim()
      const eventHref = $('.event a').attr('href')
      const eventId = eventHref ? Number(eventHref.match(/\/events\/(\d+)/)?.[1]) : undefined
      console.log('[DEBUG] 事件:', eventName, 'ID:', eventId)

      // 提取 body blocks
      const blocks: Block[] = []
      const $content = $('.newstext-con')
      console.log('[DEBUG] .newstext-con 元素數:', $content.length)

      if ($content.length === 0) {
        console.warn('[WARN] 找不到 .newstext-con')
        return {
          id,
          date,
          title,
          author,
          body: { blocks: [] },
          image_url: mainImage,
          event: eventName ? { name: eventName, id: eventId } : undefined,
          error: '找不到 .newstext-con，請檢查 URL 是否為 HLTV 官方新聞頁面'
        }
      }

      $content.children().each((i, el) => {
        const $el = $(el)
        const tag = $el.prop('tagName')?.toLowerCase() || ''
        console.log(`[DEBUG] Block ${i+1}: <${tag}>`)

        if (tag === 'p') {
          const className = $el.attr('class') || ''
          if (className.includes('headertext')) {
            blocks.push({
              type: 'header',
              data: { text: $el.text().trim() }
            })
          } else if (className.includes('news-block')) {
            blocks.push({
              type: 'paragraph',
              data: { text: $el.text().trim() }
            })
          }
        } else if (tag === 'div' && $el.hasClass('image-con')) {
          const imgSrc = $el.find('img').attr('src') || $el.find('source').attr('srcset')?.split(' ')[0]
          if (imgSrc) {
            blocks.push({
              type: 'image',
              data: { image_url: imgSrc }
            })
          }
        } else if (tag === 'a' && $el.hasClass('news-read-more-1')) {
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
      })

      console.log(`[DEBUG] 總共提取 ${blocks.length} 個 blocks`)

      return {
        id,
        date,
        title,
        author,
        body: { blocks },
        image_url: mainImage,
        event: eventName ? { name: eventName, id: eventId } : undefined
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('[ERROR] getNewsContent 失敗:', errorMsg)
      return {
        id,
        date: '',
        title: '錯誤',
        author: '系統',
        body: { blocks: [] },
        error: errorMsg || '抓取失敗，請檢查 URL 或網路'
      }
    }
  }

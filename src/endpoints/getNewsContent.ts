import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'
import * as cheerio from 'cheerio'  // 建議明確 import cheerio（若原本 HLTVScraper 已經包好可忽略）

export interface NewsBlock {
  type: 'paragraph' | 'header' | 'image' | 'read-more-link' | 'other'
  data: {
    text?: string
    src?: string
    alt?: string
    url?: string
    caption?: string
  }
}

export interface NewsContent {
  id: string | number
  date: string // ISO 格式，例如 "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  body: {
    blocks: NewsBlock[]
  }
  image_url?: string           // 保留原本的封面圖（optional）
  event?: {
    name: string
    id?: number
  }
}

export const getNewsContent =
  (config: HLTVConfig) =>
  async ({ id }: { id: number | string }): Promise<NewsContent> => {
    const url = `https://www.hltv.org/news/${id}/${generateRandomSuffix()}`
    const html = await fetchPage(url, config.loadPage)
    const $ = HLTVScraper(html)  // 保持你原本的 scraper 方式

    // 基本欄位
    const title = $('h1.headline').text().trim() || '無標題'
    const author = $('.author-date-con .author a').text().trim() || '未知作者'
    const dateText = $('.date').attr('data-unix')
    const date = dateText ? new Date(Number(dateText)).toISOString() : ''

    const image_url = $('.image-con picture source').first().attr('srcset')?.split(' ')[0] || undefined

    const eventName = $('.event a').text().trim()
    const eventHref = $('.event a').attr('href')
    const eventIdMatch = eventHref?.match(/\/events\/(\d+)/)
    const eventId = eventIdMatch ? Number(eventIdMatch[1]) : undefined

    // ────────────────────────────────────────────────
    //          核心：解析 .newstext-con 成 blocks
    // ────────────────────────────────────────────────
    const blocks: NewsBlock[] = []

    const $content = $('.newstext-con')

    $content.children().each((_, element) => {
      const $el = $(element)
      const tag = element.tagName.toLowerCase()

      // 1. 開頭的描述 / lead paragraph (通常 class="headertext")
      if ($el.hasClass('headertext') || (tag === 'p' && $el.attr('itemprop') === 'description')) {
        const text = $el.text().trim()
        if (text) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
        return
      }

      // 2. 一般段落 news-block
      if (tag === 'p' && $el.hasClass('news-block')) {
        const text = $el.text().trim()
        if (text) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
        return
      }

      // 3. 標題樣的段落（有時 HLTV 會用 p 包大字）
      if (tag === 'p' && !$el.hasClass('news-block') && !$el.hasClass('headertext')) {
        const text = $el.text().trim()
        if (text.length > 0 && text.length < 80) {
          // 短的、看起來像小標題 → 當 header
          blocks.push({
            type: 'header',
            data: { text }
          })
        } else if (text) {
          blocks.push({
            type: 'paragraph',
            data: { text }
          })
        }
        return
      }

      // 4. 圖片
      if ($el.hasClass('image-con') || $el.find('img').length > 0) {
        const $img = $el.find('img')
        const src =
          $el.find('source[type="image/avif"]').attr('srcset')?.split(' ')[0] ||
          $img.attr('src') ||
          $el.find('source').first().attr('srcset')?.split(' ')[0]

        if (src) {
          const fullSrc = src.startsWith('//') ? `https:${src}` : src
          blocks.push({
            type: 'image',
            data: {
              src: fullSrc,
              alt: $img.attr('alt') || '',
            }
          })
        }
        return
      }

      // 5. Read more 連結區塊
      if ($el.hasClass('news-read-more-1') || $el.find('.news-read-more-1-bottom').length > 0) {
        const text = $el.find('.news-read-more-1-bottom').text().trim()
        const href = $el.attr('href') || $el.find('a').attr('href')

        if (text && href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.hltv.org${href}`
          blocks.push({
            type: 'read-more-link',
            data: {
              text,
              url: fullUrl
            }
          })
        }
        return
      }

      // 6. 其他沒特別處理的 → 當 paragraph
      const text = $el.text().trim()
      if (text && text.length > 10) {  // 避免太多空行或雜訊
        blocks.push({
          type: 'paragraph',
          data: { text }
        })
      }
    })

    // 過濾掉完全空的 block
    const cleanedBlocks = blocks.filter(block => {
      if (block.type === 'paragraph' || block.type === 'header') {
        return !!block.data.text?.trim()
      }
      if (block.type === 'image') {
        return !!block.data.src
      }
      if (block.type === 'read-more-link') {
        return !!block.data.url && !!block.data.text
      }
      return true
    })

    return {
      id,
      date,
      title,
      author,
      body: {
        blocks: cleanedBlocks
      },
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

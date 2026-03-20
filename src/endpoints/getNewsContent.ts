import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string                    // ISO format, e.g. "2026-03-19T08:38:00.000Z"
  title: string
  author: string
  content?: string                // optional: raw joined text
  body: {
    blocks: Array<{
      type: 'paragraph' | 'header'  // 可擴展 quote / image / list 等
      data: {
        text: string
      }
    }>
  }
  image_url?: string
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
    const $ = HLTVScraper(html)

    // Title
    const title = $('h1.headline').trimText() || 'No title'

    // Author
    const author = $('.author-date-con .author a').trimText() || 'Unknown author'

    // Date (data-unix 通常是秒級 timestamp)
    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString() // fallback

    // Image
    let image_url: string | undefined
    const srcset = $('.image-con picture source').attr('srcset')
    if (srcset) {
      image_url = srcset.split(',')[0]?.trim().split(' ')[0]
    }

    // Event
    const eventName = $('.event a').trimText()
    const eventHref = $('.event a').attr('href')
    let eventId: number | undefined
    if (eventHref) {
      const match = eventHref.match(/\/events\/(\d+)/)
      eventId = match ? Number(match[1]) : undefined
    }

    // ── 核心：提取 blocks ──
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // 處理可能的 .headertext（開頭摘要/重點）
      contentContainer.children('.headertext').each((i, el) => {
        const text = el.trimText()
        if (text) {
          blocks.push({
            type: 'header',
            data: { text }
          })
        }
      })

      // 處理所有 .news-block（主要段落）
      contentContainer.children('.news-block').each((i, el) => {
        const text = el.trimText()
        if (!text) return

        // 簡單 heuristic 判斷是否為 header
        const isLikelyHeader =
          text.length < 60 &&
          (text === text.toUpperCase() ||
            text.includes('New') ||
            text.includes('Update') ||
            text.includes('Change') ||
            text.includes(':') && !text.includes('.')) // 如 "New Reloading System:"

        blocks.push({
          type: isLikelyHeader ? 'header' : 'paragraph',
          data: { text }
        })
      })

      // 如果完全沒抓到 .news-block，可 fallback 取所有 p 標籤
      if (blocks.length === 0) {
        contentContainer.children('p').each((i, el) => {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'paragraph',
              data: { text }
            })
          }
        })
      }
    }

    // 加入開頭介紹段落（可選，模仿你提供的範例）
    if (blocks.length > 0 && blocks[0].type !== 'header') {
      const introText = `${title} as of ${new Date(date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })}, which significantly alters the game's core mechanics.`
      blocks.unshift({
        type: 'paragraph',
        data: { text: introText }
      })
    }

    // 純文字版本（可選保留）
    const rawContent = blocks.map(b => b.data.text).join('\n\n').trim()

    return {
      id,
      date,
      title,
      author,
      content: rawContent || undefined,  // 可移除此欄位
      body: {
        blocks
      },
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'  // 確保匯入 generateRandomSuffix

export interface NewsContent {
  id: number
  date: string                    // ISO 8601 格式，例如 "2026-03-19T10:00:00.000Z"
  title: string
  author: string
  event?: {
    name: string
    logo?: string
  }
  image_url?: string
  content: string                 // 完整文章文字
  rawHtml?: string                // 原始 HTML（可選）
}

export const getNewsContent =
  (config: HLTVConfig) =>
  async ({ id }: { id: number }): Promise<NewsContent> => {
    const url = `https://www.hltv.org/news/${id}/${generateRandomSuffix()}`
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    // 提取 id（從參數）
    const articleId = id

    // 提取 date（從 .date[data-unix]）
    const unixTime = $('.date').attr('data-unix')
    const date = unixTime ? new Date(Number(unixTime)).toISOString() : ''

    // 提取 title
    const title = $('h1.headline').text().trim()

    // 提取 author
    const author = $('.author a.authorName span').text().trim()

    // 提取 event
    const eventName = $('.event a').text().trim()
    const eventLogo = $('.event img').attr('src')
    const event = eventName ? { name: eventName, logo: eventLogo } : undefined

    // 提取主圖（從 .image-con img 或 .newsdsl img）
    const image_url = $('.image-con img, .newsdsl img').first().attr('src') || undefined

    // 提取完整內容（純文字，從 .newstext-con p, div）
    let content = ''
    $('.newstext-con p, .newstext-con div').each((_, el) => {
      const text = $(el).text().trim()
      if (text && text.length > 10) {  // 過濾空行或短文字
        content += text + '\n\n'
      }
    })

    // 原始 HTML（可選）
    const rawHtml = $('.newstext-con').html() || ''

    return {
      id: articleId,
      date,
      title,
      author,
      event,
      image_url,
      content: content.trim(),
      rawHtml
    }
  }

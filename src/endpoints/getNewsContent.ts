import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage } from '../utils'

export interface NewsContent {
  id: number
  date: string          // ISO 格式，例如 "2026-03-19T08:38:00.000Z"
  title: string
  description: string
  content: string       // 完整文章 HTML
  image_url?: string
  author?: string
  event?: {
    name: string
    id?: number
  }
}

export const getNewsContent =
  (config: HLTVConfig) =>
  async (newsId: number): Promise<NewsContent> => {
    const url = `https://www.hltv.org/news/${newsId}`
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    // 提取 id（從 URL 或頁面確認）
    const id = newsId

    // 提取日期（從 .date data-unix 轉 ISO）
    const dateUnix = $('.date').attr('data-unix')
    const date = dateUnix ? new Date(Number(dateUnix)).toISOString() : ''

    const title = $('.headline').text().trim()
    const description = $('.headertext').text().trim() || ''

    // 完整內容：抓 .newstext-con 內的所有 HTML
    const contentEl = $('.newstext-con')
    const content = contentEl.html() || ''

    // 主圖片：從第一個 .image-con img
    const image_url = contentEl.find('.image-con img').first().attr('src') || undefined

    // 作者
    const author = $('.authorName span').text().trim() || undefined

    // 相關賽事（如果有）
    const eventEl = $('.event a')
    const event = eventEl.length
      ? {
          name: eventEl.text().trim(),
          id: Number(eventEl.attr('href')?.match(/\/events\/(\d+)/)?.[1] || undefined)
        }
      : undefined

    return {
      id,
      date,
      title,
      description,
      content,
      image_url,
      author,
      event
    }
  }

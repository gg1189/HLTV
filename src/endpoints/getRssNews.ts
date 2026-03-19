import { stringify } from 'querystring'
import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage } from '../utils'

export interface GetRssNewsArguments {
  year?: number
  month?: string
  eventIds?: number[]
}

export interface RssNewsItem {
  id: string              // 新增：唯一 ID（從 URL 解析或產生）
  title: string
  description: string
  url: string
  image_url?: string      // 新增：文章圖片 URL
  date: string            // 修改：ISO 8601 格式，如 2026-03-19T10:00:00.000Z
  author?: string
  category?: string
}

export const getRssNews =
  (config: HLTVConfig) =>
  async ({
    year,
    month,
    eventIds
  }: GetRssNewsArguments = {}): Promise<RssNewsItem[]> => {
    const query = stringify({
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
      ...(eventIds ? { event: eventIds } : {})
    })

    const url = `https://www.hltv.org/news/rss?${query}`
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    const newsItems: RssNewsItem[] = []

    // 抓取 RSS item（HLTV RSS 頁面結構）
    $('item').each((i, el) => {
      const $el = $(el)

      const title = $el.find('title').text().trim()
      const description = $el.find('description').text().trim()
      const link = $el.find('link').text().trim()
      const pubDateStr = $el.find('pubDate').text().trim()

      // 產生唯一 ID（用連結 hash 或流水號）
      const id = link.split('/').pop() || `news-${i}-${Date.now()}`

      // 日期轉 ISO 8601（如果 pubDateStr 是標準格式）
      let date = ''
      if (pubDateStr) {
        try {
          const parsedDate = new Date(pubDateStr)
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate.toISOString()  // 輸出如 2026-03-19T10:00:00.000Z
          }
        } catch (e) {
          console.warn('無法解析日期:', pubDateStr)
        }
      }

      // 抓取圖片（RSS description 裡可能有 <img>）
      let image_url = ''
      const imgMatch = description.match(/<img[^>]+src=["'](.*?)["']/i)
      if (imgMatch && imgMatch[1]) {
        image_url = imgMatch[1]
        // 如果是相對路徑，補完整
        if (image_url.startsWith('/')) {
          image_url = 'https://www.hltv.org' + image_url
        }
      }

      newsItems.push({
        id,
        title,
        description,
        url: link,
        image_url: image_url || undefined,
        date,
        author: $el.find('author').text().trim() || undefined,
        category: $el.find('category').text().trim() || undefined
      })
    })

    return newsItems
  }

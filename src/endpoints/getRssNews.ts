import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage } from '../utils'

export interface RssArticle {
  id: number
  title: string
  description: string
  link: string
  image_url?: string  // 新增，可選
  date: string        // 改成 ISO 格式，例如 "2026-03-19T10:00:00.000Z"
}

const urlify = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex)
}

// 從 description 提取第一張圖片的 src
const extractImageUrl = (description: string): string | undefined => {
  const imgRegex = /<img[^>]+src=["'](.*?)["']/i
  const match = description.match(imgRegex)
  return match ? match[1] : undefined
}

// 從 link 提取 ID（例如 /news/12345/title → 12345）
const extractIdFromLink = (link: string): number => {
  const match = link.match(/\/news\/(\d+)/)
  return match ? Number(match[1]) : 0
}

export const getRssNews =
  (config: HLTVConfig) => async (): Promise<RssArticle[]> => {
    const url = 'https://www.hltv.org/rss/news'
    const $ = HLTVScraper(await fetchPage(url, config.loadPage))

    return $('item')
      .toArray()
      .map((el) => {
        const title = el.find('title').text().trim()
        const description = el.find('description').text().trim()
        const link = urlify(el.text())?.[0] || ''  // 取第一個 URL 作為 link

        const pubDateStr = el.find('pubDate').text().trim()
        const date = pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString()

        const id = extractIdFromLink(link)
        const image_url = extractImageUrl(description)

        return {
          id,
          title,
          description,
          link,
          image_url,
          date
        }
      })
      .filter(article => article.id > 0)  // 過濾掉無法提取 ID 的文章
  }

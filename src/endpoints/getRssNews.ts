import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage } from '../utils'

export interface RssArticle {
  id: number
  title: string
  description: string
  link: string
  date: string  // ISO 8601 格式，例如 "2026-03-19T00:38:00.000Z"
  image_url?: string  // 可選，從 media:content 提取
}

const urlify = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex)
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
        const link = urlify(el.text())?.[0] || ''

        // 提取 id：從 guid 取 hltvnews44130 → 44130
        const guid = el.find('guid').text().trim()
        const id = guid.startsWith('hltvnews') ? Number(guid.replace('hltvnews', '')) : 0

        // 提取 image_url：從 <media:content url="...">
        const image_url = el.find('media\\:content').attr('url') || undefined

        // 日期：從 pubDate 轉成 ISO 8601
        const pubDateText = el.find('pubDate').text().trim()
        const date = pubDateText ? new Date(pubDateText).toISOString() : ''

        return {
          id,
          title,
          description,
          link,
          date,
          image_url
        }
      })
      .filter(article => article.id > 0)  // 過濾掉沒有 id 的項目
  }

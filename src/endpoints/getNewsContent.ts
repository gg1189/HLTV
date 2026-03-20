import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { fetchPage, generateRandomSuffix } from '../utils'

export interface NewsContent {
  id: string | number
  date: string
  title: string
  author: string
  body: {
    blocks: Array<{
      type: 'paragraph' | 'header' | 'image' | 'table'
      data: {
        text?: string          // paragraph / header
        url?: string           // image
        eventName?: string     // table
        matches?: Array<{
          date: string
          time: string
          team1: string
          team2: string
          matchLink: string
        }>
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

    const title = $('h1.headline').trimText() || 'No title'
    const author = $('.author-date-con .author a').trimText() || 'Unknown author'

    const dateUnix = $('.date').numFromAttr('data-unix')
    const date = dateUnix
      ? new Date(dateUnix * 1000).toISOString()
      : new Date().toISOString()

    let image_url: string | undefined
    const srcsetMain = $('.image-con picture source').attr('srcset')
    if (srcsetMain) {
      image_url = srcsetMain.split(',')[0]?.trim().split(' ')[0]
    }

    const eventName = $('.event a').trimText()
    const eventHref = $('.event a').attr('href')
    let eventId: number | undefined
    if (eventHref) {
      const match = eventHref.match(/\/events\/(\d+)/)
      eventId = match ? Number(match[1]) : undefined
    }

    // ── 提取 blocks ──
    const blocks: NewsContent['body']['blocks'] = []

    const contentContainer = $('.newsdsl .newstext-con').first()

    if (contentContainer.exists()) {
      // 擴大範圍：抓所有相關子元素
      const relevantChildren = contentContainer
        .children('p.headertext, p.news-block, div.image-con, table.table-container')
        .toArray()

      relevantChildren.forEach((el) => {
        const className = el.attr('class') || ''

        if (className.includes('headertext')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'header',
              data: { text }
            })
          }
        } else if (className.includes('news-block')) {
          const text = el.trimText()
          if (text) {
            blocks.push({
              type: 'paragraph',
              data: { text }
            })
          }
        } else if (className.includes('image-con')) {
          let imgUrl = el.find('picture source').attr('srcset')?.split(',')[0]?.trim().split(' ')[0]
          if (!imgUrl) {
            imgUrl = el.find('img').attr('src')
          }
          if (imgUrl) {
            blocks.push({
              type: 'image',
              data: { url: imgUrl }
            })
          }
        } else if (className.includes('table-container')) {
          // 處理嵌入的賽事表格
          const tableEventName = el.find('.event-header-cell a').trimText() || 'Unknown event'

          const matches: any[] = []

          el.find('tbody tr.team-row').each((i, rowEl) => {
            const $row = $(rowEl)

            const date = $row.find('.date-cell span').text().trim() || ''
            const time = $row.find('.time-cell span').text().trim() || ''

            const team1 = $row.find('.team-1').trimText() || ''
            const team2 = $row.find('.team-2').trimText() || ''

            const matchLink = $row.find('.stats-button').attr('href') || ''

            if (team1 && team2) {
              matches.push({
                date,
                time,
                team1,
                team2,
                matchLink: matchLink ? `https://www.hltv.org${matchLink}` : undefined
              })
            }
          })

          if (matches.length > 0) {
            blocks.push({
              type: 'table',
              data: {
                eventName: tableEventName,
                matches
              }
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
      body: {
        blocks
      },
      image_url,
      event: eventName ? { name: eventName, id: eventId } : undefined
    }
  }

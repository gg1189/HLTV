import { stringify } from 'querystring'
import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
import { Team } from '../shared/Team'
import { Event } from '../shared/Event'
import { fetchPage } from '../utils'

export enum MatchEventType {
  All = 'All',
  LAN = 'Lan',
  Online = 'Online'
}

export enum MatchFilter {
  LanOnly = 'lan_only',
  TopTier = 'top_tier'
}

export interface GetMatchesArguments {
  eventIds?: number[]
  eventType?: MatchEventType
  filter?: MatchFilter
  teamIds?: number[]
}

export interface MatchPreview {
  id: number
  team1?: Team
  team2?: Team
  date?: number
  format?: string
  event?: Event
  live: boolean
  stars: number
  ranked: boolean
  region: string
}

export const getMatches =
  (config: HLTVConfig) =>
  async ({
    eventIds,
    eventType,
    filter,
    teamIds
  }: GetMatchesArguments = {}): Promise<MatchPreview[]> => {
    const query = stringify({
      ...(eventIds ? { event: eventIds } : {}),
      ...(eventType ? { eventType } : {}),
      ...(filter ? { predefinedFilter: filter } : {}),
      ...(teamIds ? { team: teamIds } : {})
    })

    const $ = HLTVScraper(
      await fetchPage(`https://www.hltv.org/matches?${query}`, config.loadPage)
    )

    // all live matches
    const liveMatches = $('.liveMatches > .match-wrapper')
      .toArray()
      .map((el) => {
        const id = el.numFromAttr('data-match-id')!
        const stars = el.numFromAttr('data-stars')!
        const ranked = el.attr('data-eventtype') === 'ranked'
        const region = el.attr('data-region')
        const lan = el.attr('lan') === 'true'  // 注意這裡原碼寫 lan，但屬性是 lan="true"
        const live = el.attr('live') === 'true'
        const date = undefined

        // team1
        const team1El = el.find('.match-teams .match-team').first()
        const team1: Team = {
          id: el.numFromAttr('team1'),
          name: team1El.find('.match-teamname').text().trim(),
          logo: getLogoUrl(team1El)
        }

        // team2
        const team2El = el.find('.match-teams .match-team').last()
        const team2: Team = {
          id: el.numFromAttr('team2'),
          name: team2El.find('.match-teamname').text().trim(),
          logo: getLogoUrl(team2El)
        }

        const event = {
          id: el.numFromAttr('data-event-id'),
          name: el.find('.match-event').first().attr('data-event-headline')
        }
        const format = el
          .find('.match-meta:not(.match-meta-live)')
          .text()

        return {
          id,
          date,
          stars,
          team1,
          team2,
          format,
          event,
          live,
          lan,
          region,
          ranked
        }
      })

    const upcomingMatches = $('.matches-event-wrapper')
      .toArray()
      .map(el => {
        const event = {
          id: el.find('.event-headline-wrapper').numFromAttr('data-event-id'),
          name: el.find('.event-headline-wrapper').attr('data-event-headline')
        }

        return el.find('.match-wrapper')
          .toArray()
          .map(matchEl => {
            const id = matchEl.numFromAttr('data-match-id')!
            const stars = matchEl.numFromAttr('data-stars')!
            const ranked = matchEl.attr('data-eventtype') === 'ranked'
            const region = matchEl.attr('data-region')
            const lan = matchEl.attr('lan') === 'true'
            const live = matchEl.attr('live') === 'true'
            const date = matchEl.find('.match-time').numFromAttr('data-unix')

            // team1
            const team1El = matchEl.find('.match-teams .match-team').first()
            const team1: Team = {
              id: matchEl.numFromAttr('team1'),
              name: team1El.find('.match-teamname').text().trim(),
              logo: getLogoUrl(team1El)
            }

            // team2
            const team2El = matchEl.find('.match-teams .match-team').last()
            const team2: Team = {
              id: matchEl.numFromAttr('team2'),
              name: team2El.find('.match-teamname').text().trim(),
              logo: getLogoUrl(team2El)
            }

            const format = matchEl
              .find('.match-meta')
              .first()
              .text()

            return {
              id,
              date,
              stars,
              team1,
              team2,
              format,
              event,
              live,
              lan,
              region,
              ranked
            }
          })
      })

    return [...liveMatches, ...upcomingMatches.flat()]
  }

// Helper function to extract full logo URL
function getLogoUrl(teamEl: any): string | undefined {
  let src = teamEl.find('img.match-team-logo').attr('src')

  // 如果有多張圖（day/night），優先取 night-only 或第一張
  if (!src) {
    src = teamEl.find('img.night-only').attr('src') || teamEl.find('img.day-only').attr('src')
  }

  if (!src) {
    return undefined
  }

  // 已經是完整 URL 就直接回傳
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }

  // 相對路徑補完整
  if (src.startsWith('/')) {
    return `https://www.hltv.org${src}`
  }

  // 避免 placeholder
  if (src.includes('teamplaceholder') || src.includes('dynamic-svg')) {
    return undefined
  }

  // 其他情況也補完整域名
  return `https://www.hltv.org${src.startsWith('/') ? '' : '/'}${src}`
}

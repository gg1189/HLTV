import { stringify } from 'querystring'
import { HLTVConfig } from '../config'
import { HLTVScraper } from '../scraper'
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

export interface SimpleMatch {
  id: number
  status: 'current' | 'upcoming'
  time?: string          // ISO string, for upcoming it's scheduled time, for current it's optional/current time
  event: {
    name: string
    logo?: string
  }
  stars: number
  maps: string
  teams: Array<{
    id?: number
    name: string
    logo?: string
  }>
}

export const getMatches =
  (config: HLTVConfig) =>
  async ({
    eventIds,
    eventType,
    filter,
    teamIds
  }: GetMatchesArguments = {}): Promise<SimpleMatch[]> => {
    const query = stringify({
      ...(eventIds ? { event: eventIds } : {}),
      ...(eventType ? { eventType } : {}),
      ...(filter ? { predefinedFilter: filter } : {}),
      ...(teamIds ? { team: teamIds } : {})
    })

    const $ = HLTVScraper(
      await fetchPage(`https://www.hltv.org/matches?${query}`, config.loadPage)
    )

    const getLogoUrl = (el: any): string | undefined => {
      let src = el.find('img').attr('src') || ''

      if (src.includes('teamplaceholder') || src.includes('dynamic-svg')) {
        return undefined
      }

      if (src.startsWith('http')) return src
      if (src.startsWith('/')) return `https://www.hltv.org${src}`

      return undefined
    }

    // Live matches (current)
    const liveMatches = $('.liveMatches > .match-wrapper')
      .toArray()
      .map((el) => {
        const id = el.numFromAttr('data-match-id')!
        const stars = el.numFromAttr('data-stars')!

        const eventName = el.find('.match-event').first().attr('data-event-headline') || ''
        const eventLogoEl = el.find('.match-event-logo')
        const eventLogo = getLogoUrl({ find: () => eventLogoEl })

        const maps = el
          .find('.match-meta:not(.match-meta-live)')
          .text()
          .trim() || 'bo?'

        const team1El = el.find('.match-teams .match-team').first()
        const team2El = el.find('.match-teams .match-team').last()

        const teams = [
          {
            id: el.numFromAttr('team1'),
            name: team1El.find('.match-teamname').text().trim(),
            logo: getLogoUrl(team1El)
          },
          {
            id: el.numFromAttr('team2'),
            name: team2El.find('.match-teamname').text().trim(),
            logo: getLogoUrl(team2El)
          }
        ]

        return {
          id,
          status: 'current' as const,
          time: new Date().toISOString(),  // 或留 undefined，看你需求
          event: { name: eventName, logo: eventLogo },
          stars,
          maps,
          teams
        }
      })

    // Upcoming matches
    const upcomingMatches = $('.matches-event-wrapper')
      .toArray()
      .flatMap((el) => {
        const eventName = el.find('.event-headline-wrapper').attr('data-event-headline') || ''
        const eventLogoEl = el.find('.event-logo img')
        const eventLogo = getLogoUrl({ find: () => eventLogoEl })

        return el.find('.match-wrapper')
          .toArray()
          .map((matchEl) => {
            const id = matchEl.numFromAttr('data-match-id')!
            const stars = matchEl.numFromAttr('data-stars')!
            const unixTime = matchEl.find('.match-time').numFromAttr('data-unix')
            const time = unixTime ? new Date(unixTime).toISOString() : undefined

            const maps = matchEl
              .find('.match-meta')
              .first()
              .text()
              .trim() || 'bo?'

            const team1El = matchEl.find('.match-teams .match-team').first()
            const team2El = matchEl.find('.match-teams .match-team').last()

            const teams = [
              {
                id: matchEl.numFromAttr('team1'),
                name: team1El.find('.match-teamname').text().trim(),
                logo: getLogoUrl(team1El)
              },
              {
                id: matchEl.numFromAttr('team2'),
                name: team2El.find('.match-teamname').text().trim(),
                logo: getLogoUrl(team2El)
              }
            ]

            return {
              id,
              status: 'upcoming' as const,
              time,
              event: { name: eventName, logo: eventLogo },
              stars,
              maps,
              teams
            }
          })
      })

    return [...liveMatches, ...upcomingMatches]
  }

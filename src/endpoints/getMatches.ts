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
  time?: string          // ISO string
  event: {
    name: string
    logo?: string        // full URL
  }
  stars: number
  maps: string
  teams: Array<{
    id?: number
    name: string
    logo?: string        // full URL
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

    // Helper to extract full logo URL
    const getLogoUrl = (el: any): string | undefined => {
      // Support multiple selectors for live and upcoming
      let imgEls = el.find('img.match-event-logo, img.event-logo img, img.match-team-logo, img')

      if (imgEls.length === 0) return undefined

      // Prefer night-only or day-only if exists
      let src =
        imgEls.filter('.night-only').attr('src') ||
        imgEls.filter('.day-only').attr('src') ||
        imgEls.first().attr('src') ||
        ''

      if (!src) return undefined

      // Skip placeholders
      if (src.includes('teamplaceholder') || src.includes('dynamic-svg')) {
        return undefined
      }

      // Make sure it's full URL
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
        const eventLogoEl = el.find('.match-event-logo-container')
        const eventLogo = getLogoUrl(eventLogoEl)

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
          time: new Date().toISOString(),  // current time for live matches
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
        const eventLogoEl = el.find('.event-logo')
        const eventLogo = getLogoUrl(eventLogoEl)

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

    // Combine and return
    return [...liveMatches, ...upcomingMatches]
  }

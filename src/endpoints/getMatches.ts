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
  time?: string
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

    // Helper function to get full logo URL
    const getLogoUrl = (el: any): string | undefined => {
      // Find the img element
      let imgEl = el.find('img')
      let src = imgEl.attr('src') || ''

      // If multiple images (day/night), prefer night-only or first one
      if (!src) {
        src = imgEl.filter('.night-only').attr('src') ||
              imgEl.filter('.day-only').attr('src') ||
              imgEl.first().attr('src') || ''
      }

      if (!src) return undefined

      // Skip placeholders
      if (src.includes('teamplaceholder') || src.includes('dynamic-svg')) {
        return undefined
      }

      // Already full URL
      if (src.startsWith('http://') || src.startsWith('https://')) {
        return src
      }

      // Relative path → make full
      return `https://www.hltv.org${src.startsWith('/') ? '' : '/'}${src}`
    }

    // Live matches (current)
    const liveMatches = $('.liveMatches > .match-wrapper')
      .toArray()
      .map((el) => {
        const id = el.numFromAttr('data-match-id')!
        const stars = el.numFromAttr('data-stars')!

        // Event info
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
          time: new Date().toISOString(), // or undefined if you prefer no time for live
          event: {
            name: eventName,
            logo: eventLogo
          },
          stars,
          maps,
          teams
        }
      })

    // Upcoming matches (with event logo)
    const upcomingMatches = $('.matches-event-wrapper')
      .toArray()
      .flatMap((eventEl) => {
        // Event logo for upcoming section
        const eventLogoEl = eventEl.find('.event-logo')
        const eventLogo = getLogoUrl(eventLogoEl)

        const eventName = eventEl.find('.event-headline-wrapper').attr('data-event-headline') || ''

        return eventEl.find('.match-wrapper')
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
              event: {
                name: eventName,
                logo: eventLogo
              },
              stars,
              maps,
              teams
            }
          })
      })

    // Combine and return
    return [...liveMatches, ...upcomingMatches]
  }

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

    // Helper: Make src full URL and skip placeholders
    const getFullLogo = (src?: string): string | undefined => {
      if (!src) return undefined
      //if (src.includes('teamplaceholder') || src.includes('dynamic-svg')) return undefined
      if (src.startsWith('http')) return src
      return `https://www.hltv.org${src.startsWith('/') ? '' : '/'}${src}`
    }

    // Live matches
    const liveMatches = $('.liveMatches > .match-wrapper')
      .toArray()
      .map((el) => {
        const id = el.numFromAttr('data-match-id')!
        const stars = el.numFromAttr('data-stars')!

        const eventName = el.find('.match-event').first().attr('data-event-headline') || ''
        const eventLogoSrc = el.find('img.match-event-logo').first().attr('src')
        const eventLogo = getFullLogo(eventLogoSrc)

        const maps = el.find('.match-meta:not(.match-meta-live)').text().trim() || 'bo?'

        const team1El = el.find('.match-teams .match-team').first()
        const team2El = el.find('.match-teams .match-team').last()

        const team1 = {
          id: el.numFromAttr('team1'),
          name: team1El.find('.match-teamname').text().trim(),
          logo: getFullLogo(team1El.find('img.match-team-logo').first().attr('src'))
        }

        const team2 = {
          id: el.numFromAttr('team2'),
          name: team2El.find('.match-teamname').text().trim(),
          logo: getFullLogo(team2El.find('img.match-team-logo').first().attr('src'))
        }

        return {
          id,
          status: 'current' as const,
          time: new Date().toISOString(),
          event: { name: eventName, logo: eventLogo },
          stars,
          maps,
          teams: [team1, team2]
        }
      })

    // Upcoming matches (using direct class selectors like getResults)
    const upcomingMatches = $('.matches-event-wrapper')
      .toArray()
      .flatMap((eventEl) => {
        // Event logo & name - direct like getResults
        const eventLogoSrc = eventEl.find('img.match-event-logo').first().attr('src')
        const eventLogo = getFullLogo(eventLogoSrc)

        const eventName = eventEl.find('.event-headline-wrapper').attr('data-event-headline') ||
                          eventEl.find('.event-headline-text').text().trim() ||
                          ''

        return eventEl.find('.match-wrapper')
          .toArray()
          .map((matchEl) => {
            const id = matchEl.numFromAttr('data-match-id')!
            const stars = matchEl.numFromAttr('data-stars')!
            const unixTime = matchEl.find('.match-time').numFromAttr('data-unix')
            const time = unixTime ? new Date(unixTime).toISOString() : undefined

            const maps = matchEl.find('.match-meta').first().text().trim() || 'bo?'

            // Team logos - direct like getResults
            const team1El = matchEl.find('.match-team.team1')
            const team2El = matchEl.find('.match-team.team2')

            const team1 = {
              id: matchEl.numFromAttr('team1'),
              name: team1El.find('.match-teamname').text().trim(),
              logo: getFullLogo(team1El.find('img.match-team-logo').first().attr('src'))
            }

            const team2 = {
              id: matchEl.numFromAttr('team2'),
              name: team2El.find('.match-teamname').text().trim(),
              logo: getFullLogo(team2El.find('img.match-team-logo').first().attr('src'))
            }

            return {
              id,
              status: 'upcoming' as const,
              time,
              event: { name: eventName, logo: eventLogo },
              stars,
              maps,
              teams: [team1, team2]
            }
          })
      })

    return [...liveMatches, ...upcomingMatches]
  }

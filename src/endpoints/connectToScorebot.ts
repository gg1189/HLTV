import * as io from 'socket.io-client'
import { HLTVConfig } from '../config'

// 所有 interface 保持不變
type Side = 'CT' | 'TERRORIST' | 'SPECTATOR'

type LogEvent =
  | RoundStart
  | RoundEnd
  | Restart
  | MatchStarted
  | Kill
  | Assist
  | Suicide
  | BombDefused
  | BombPlanted
  | PlayerJoin
  | PlayerQuit

interface RoundStart {
  RoundStart: {}
}

interface MatchStarted {
  MatchStarted: {
    map: string
  }
}

interface Restart {
  Restart: {}
}

interface PlayerJoin {
  PlayerJoin: {
    playerName: string
    playerNick: string
  }
}

interface PlayerQuit {
  PlayerQuit: {
    playerName: string
    playerNick: string
    playerSide: Side
  }
}

interface RoundEnd {
  RoundEnd: {
    counterTerroristScore: number
    terroristScore: number
    winner: Side
    winType: WinType
  }
}

interface Kill {
  Kill: {
    killerName: string
    killerNick: string
    killerSide: Side
    victimName: string
    victimSide: Side
    victimNick: string
    weapon: string
    headShot: boolean
    eventId: number
    victimX: number
    victimY: number
    killerX: number
    killerY: number
    killerId: number
    victimId: number
    flasherNick?: string
    flasherSide?: Side
  }
}

interface Assist {
  Assist: {
    assisterName: string
    assisterNick: string
    assisterSide: Side
    victimNick: string
    victimName: string
    victimSide: Side
    killEventId: number
  }
}

interface Suicide {
  Suicide: {
    playerName: string
    playerNick: string
    side: Side
    weapon: string
  }
}

interface BombDefused {
  BombDefused: {
    playerName: string
    playerNick: string
  }
}

interface BombPlanted {
  BombPlanted: {
    playerName: string
    playerNick: string
    ctPlayers: number
    tPlayers: number
  }
}

export interface LogUpdate {
  log: LogEvent[]
}

export interface ScoreboardPlayer {
  steamId: string
  dbId: number
  name: string
  score: number
  deaths: number
  assists: number
  alive: boolean
  money: number
  damagePrRound: number
  hp: number
  primaryWeapon?: string
  kevlar: boolean
  helmet: boolean
  nick: string
  hasDefuseKit: boolean
  advancedStats: {
    kast: number
    entryKills: number
    entryDeaths: number
    multiKillRounds: number
    oneOnXWins: number
    flashAssists: number
  }
}

export enum WinType {
  Lost = 'lost',
  TerroristsWin = 'Terrorists_Win',
  CTsWin = 'CTs_Win',
  TargetBombed = 'Target_Bombed',
  BombDefused = 'Bomb_Defused'
}

interface ScoreboardRound {
  type: WinType
  roundOrdinal: number
  survivingPlayers: number
}

export interface ScoreboardUpdate {
  TERRORIST: ScoreboardPlayer[]
  CT: ScoreboardPlayer[]
  ctMatchHistory: {
    firstHalf: ScoreboardRound[]
    secondHalf: ScoreboardRound[]
  }
  terroristMatchHistory: {
    firstHalf: ScoreboardRound[]
    secondHalf: ScoreboardRound[]
  }
  bombPlanted: boolean
  mapName: string
  terroristTeamName: string
  ctTeamName: string
  currentRound: number
  counterTerroristScore: number
  terroristScore: number
  ctTeamId: number
  tTeamId: number
  frozen: boolean
  live: boolean
  ctTeamScore: number
  tTeamScore: number
  startingCt: number
  startingT: number
}

type ConnectToScorebotParams = {
  id: number
  onScoreboardUpdate?: (data: ScoreboardUpdate, done: () => void) => any
  onLogUpdate?: (data: LogUpdate, done: () => void) => any
  onFullLogUpdate?: (data: unknown, done: () => void) => any
  onConnect?: () => any
  onDisconnect?: () => any
}

export const connectToScorebot =
  (config: HLTVConfig) =>
  ({
    id,
    onScoreboardUpdate,
    onLogUpdate,
    onFullLogUpdate,
    onConnect,
    onDisconnect
  }: ConnectToScorebotParams) => {
    // 基底 URL 永遠固定（根據你提供的資訊）
    const baseUrl = 'https://scorebot-lb.hltv.org'

    // 轉成 websocket URL
    let wsUrl = baseUrl.replace(/^https?:\/\//, 'wss://')

    // 加上 socket.io 路徑（如果沒有）
    if (!wsUrl.includes('/socket.io/')) {
      if (!wsUrl.endsWith('/')) wsUrl += '/'
      wsUrl += 'socket.io/'
    }

    console.log('生成的 websocket URL:', wsUrl)  // debug

    // 建立連線
    const socket = io.connect(wsUrl, {
      agent: !config.httpAgent,
      transports: ['websocket'],  // 優先使用 websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    })

    // 準備 readyForMatch 事件 payload
    const matchIdStr = id.toString()
    const initObject = JSON.stringify({
      token: '',  // 目前不需要 token
      listId: matchIdStr
    })

    let reconnected = false

    socket.on('connect', () => {
      console.log('socket 已連線成功！')  // debug

      const done = () => {
        console.log('主動關閉 socket')
        socket.close()
      }

      if (onConnect) {
        onConnect()
      }

      if (!reconnected) {
        console.log('發送 readyForMatch 事件:', initObject)
        socket.emit('readyForMatch', initObject)
      }

      socket.on('scoreboard', (data: ScoreboardUpdate) => {
        console.log('收到 scoreboard 更新')
        if (onScoreboardUpdate) {
          onScoreboardUpdate(data, done)
        }
      })

      socket.on('log', (data: string) => {
        console.log('收到 log 更新')
        if (onLogUpdate) {
          onLogUpdate(JSON.parse(data), done)
        }
      })

      socket.on('fullLog', (data: any) => {
        console.log('收到 fullLog 更新')
        if (onFullLogUpdate) {
          onFullLogUpdate(JSON.parse(data), done)
        }
      })
    })

    socket.on('reconnect', () => {
      reconnected = true
      console.log('重新連線，重新發送 readyForMatch')
      socket.emit('readyForMatch', initObject)
    })

    socket.on('disconnect', (reason) => {
      console.log('socket 斷線，原因:', reason)
      if (onDisconnect) {
        onDisconnect()
      }
    })

    socket.on('connect_error', (err) => {
      console.error('連線錯誤:', err.message || err)
    })

    socket.on('error', (err) => {
      console.error('socket error:', err)
    })

    // 回傳 socket 物件，讓外部可以 close
    return socket
  }

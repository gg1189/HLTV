import * as io from 'socket.io-client'
import { fetchPage, generateRandomSuffix } from '../utils'
import { HLTVConfig } from '../config'

// 型別定義保持原樣（省略重複部分）

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
    fetchPage(
      `https://www.hltv.org/matches/${id}/${generateRandomSuffix()}`,
      config.loadPage
    ).then(($) => {
      const baseUrl = $('#scoreboardElement').attr('data-scorebot-url')

      if (!baseUrl) {
        throw new Error('無法提取 data-scorebot-url')
      }

      // 強制轉成 wss:// + /socket.io/
      let wsUrl = baseUrl.replace(/^https?:\/\//, 'wss://')
      if (!wsUrl.endsWith('/')) wsUrl += '/'
      wsUrl += 'socket.io/'

      // 加 matchId 參數
      wsUrl += `?matchId=${id}`

      console.log('直接 websocket URL:', wsUrl)

      const socket = io.connect(wsUrl, {
        agent: !config.httpAgent,
        transports: ['websocket'], // 只用 websocket，不 polling
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 30000,
        forceNew: true
      })

      const matchIdStr = id.toString()
      const initObject = JSON.stringify({
        token: '',
        listId: matchIdStr
      })

      let reconnected = false

      socket.on('connect', () => {
        console.log('websocket 已連線成功！')

        const done = () => socket.close()

        if (onConnect) onConnect()

        if (!reconnected) {
          console.log('發送 readyForMatch:', initObject)
          socket.emit('readyForMatch', initObject)
        }

        socket.on('scoreboard', (data: ScoreboardUpdate) => {
          console.log('收到 scoreboard 更新')
          if (onScoreboardUpdate) onScoreboardUpdate(data, done)
        })

        socket.on('log', (data: string) => {
          console.log('收到 log 更新')
          if (onLogUpdate) onLogUpdate(JSON.parse(data), done)
        })

        socket.on('fullLog', (data: any) => {
          console.log('收到 fullLog 更新')
          if (onFullLogUpdate) onFullLogUpdate(JSON.parse(data), done)
        })
      })

      socket.on('reconnect', () => {
        reconnected = true
        console.log('重新連線，重新發送 readyForMatch')
        socket.emit('readyForMatch', initObject)
      })

      socket.on('disconnect', (reason: string) => {
        console.log('socket 斷線，原因:', reason)
        if (onDisconnect) onDisconnect()
      })

      socket.on('connect_error', (err: Error | string) => {
        console.error('連線錯誤:', err instanceof Error ? err.message : err)
      })

      socket.on('error', (err: Error | string) => {
        console.error('socket error:', err instanceof Error ? err.message : err)
      })

      return socket
    }).catch(err => {
      console.error('初始化失敗:', err)
    })
  }

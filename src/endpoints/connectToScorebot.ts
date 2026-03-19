import * as io from 'socket.io-client'
import { fetchPage, generateRandomSuffix } from '../utils'
import { HLTVConfig } from '../config'

// 所有型別定義保持原樣（省略重複部分，確保你檔案裡有這些 interface）
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

// ... (你的所有 interface 如 RoundStart, ScoreboardUpdate, LogUpdate 等)

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
        throw new Error('無法提取 data-scorebot-url，請確認 match 是否 live')
      }

      // 固定基底，但用 polling 先連線取得 sid
      const pollingUrl = baseUrl.replace(/^https?:\/\//, 'https://') + '/socket.io/'

      console.log('開始 polling 取得 sid，使用 URL:', pollingUrl)

      // 先用 polling 建立連線，取得 sid
      const socket = io.connect(pollingUrl, {
        agent: !config.httpAgent,
        transports: ['polling'],  // 先用 polling
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      })

      const matchIdStr = id.toString()
      const initObject = JSON.stringify({
        token: '',
        listId: matchIdStr
      })

      let reconnected = false

      socket.on('connect', () => {
        console.log('polling 連線成功！嘗試升級到 websocket')

        // 升級到 websocket
        socket.io.opts.transports = ['websocket']
        socket.io.opts.upgrade = true

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
      console.error('fetchPage 失敗:', err)
    })
  }

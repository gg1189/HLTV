import * as io from 'socket.io-client'
import { HLTVConfig } from '../config'

// 所有 interface 保持不變（我只貼關鍵部分，省略重複）
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

// ... (你的所有 interface 如 RoundStart, MatchStarted, ScoreboardUpdate 等保持原樣)

// ConnectToScorebotParams 保持不變
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
    // 基底 URL 永遠固定
    const baseUrl = 'https://scorebot-lb.hltv.org'

    // 轉成 websocket URL
    let wsUrl = baseUrl.replace(/^https?:\/\//, 'wss://')

    // 加上 socket.io 路徑
    if (!wsUrl.endsWith('/')) wsUrl += '/'
    wsUrl += 'socket.io/'

    console.log('生成的 websocket URL:', wsUrl)  // debug

    const socket = io.connect(wsUrl, {
      agent: !config.httpAgent,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    })

    const matchIdStr = id.toString()
    const initObject = JSON.stringify({
      token: '',
      listId: matchIdStr
    })

    let reconnected = false

    socket.on('connect', () => {
      console.log('socket 已連線成功！')

      const done = () => {
        console.log('主動關閉 socket')
        socket.close()
      }

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

    // 修正：指定 reason 型別為 string
    socket.on('disconnect', (reason: string) => {
      console.log('socket 斷線，原因:', reason)
      if (onDisconnect) onDisconnect()
    })

    // 修正：指定 err 型別為 Error | string
    socket.on('connect_error', (err: Error | string) => {
      console.error('連線錯誤:', err instanceof Error ? err.message : err)
    })

    socket.on('error', (err: Error | string) => {
      console.error('socket error:', err instanceof Error ? err.message : err)
    })

    return socket
  }

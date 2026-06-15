import type { WSMessage, WSConnectionStatus, WSMessageType } from '@/types/websocket'

type MessageHandler = (message: WSMessage) => void
type StatusHandler = (status: WSConnectionStatus) => void

export class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private messageHandlers = new Map<WSMessageType, Set<MessageHandler>>()
  private statusHandlers = new Set<StatusHandler>()
  private status: WSConnectionStatus = 'disconnected'
  private pendingMessages: WSMessage[] = []

  constructor(url: string) {
    this.url = url
  }

  connect(): void {
    if (this.status === 'connecting' || this.status === 'connected') {
      return
    }

    this.setStatus('connecting')

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.setStatus('connected')
        this.startHeartbeat()
        this.flushPendingMessages()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          this.dispatchMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onerror = () => {
        this.setStatus('error')
      }

      this.ws.onclose = () => {
        this.stopHeartbeat()
        this.setStatus('disconnected')
        this.scheduleReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.setStatus('error')
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setStatus('disconnected')
    this.reconnectAttempts = 0
  }

  send(message: WSMessage): void {
    if (this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.pendingMessages.push(message)
    }
  }

  on(type: WSMessageType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)!.add(handler)
    return () => {
      this.messageHandlers.get(type)?.delete(handler)
    }
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    handler(this.status)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  getStatus(): WSConnectionStatus {
    return this.status
  }

  private setStatus(status: WSConnectionStatus): void {
    if (this.status !== status) {
      this.status = status
      this.statusHandlers.forEach((handler) => handler(status))
    }
  }

  private dispatchMessage(message: WSMessage): void {
    const handlers = this.messageHandlers.get(message.type)
    if (handlers) {
      handlers.forEach((handler) => handler(message))
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.status === 'connected') {
        this.send({
          type: 'heartbeat',
          timestamp: Date.now()
        })
      }
    }, 30000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error')
      return
    }

    this.setStatus('reconnecting')
    this.reconnectAttempts++

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    )

    setTimeout(() => {
      if (this.status === 'reconnecting') {
        this.connect()
      }
    }, delay)
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift()
      if (message) {
        this.send(message)
      }
    }
  }
}

let globalClient: WebSocketClient | null = null

export function createWebSocketClient(url: string): WebSocketClient {
  if (globalClient) {
    globalClient.disconnect()
  }
  globalClient = new WebSocketClient(url)
  return globalClient
}

export function getWebSocketClient(): WebSocketClient | null {
  return globalClient
}

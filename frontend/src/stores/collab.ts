import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types/user'
import type { WSConnectionStatus, WSUserPresence } from '@/types/websocket'
import { createWebSocketClient, getWebSocketClient } from '@/utils/websocketClient'
import type { WSMessage, WSMessageType } from '@/types/websocket'

export const useCollabStore = defineStore('collab', () => {
  const currentUser = ref<User | null>(null)
  const onlineUsers = ref<Map<string, WSUserPresence>>(new Map())
  const connectionStatus = ref<WSConnectionStatus>('disconnected')
  const currentDatasetId = ref<string | null>(null)

  const isOnline = computed(() => connectionStatus.value === 'connected')
  const onlineUserCount = computed(() => onlineUsers.value.size)

  function login(user: User, token: string) {
    currentUser.value = user
    localStorage.setItem('auth_token', token)
  }

  function logout() {
    disconnect()
    currentUser.value = null
    localStorage.removeItem('auth_token')
  }

  function connect(datasetId: string) {
    currentDatasetId.value = datasetId
    const token = localStorage.getItem('auth_token') || ''
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?token=${token}`
    const client = createWebSocketClient(wsUrl)

    client.onStatusChange((status) => {
      connectionStatus.value = status
    })

    client.on('auth-success' as WSMessageType, (msg: WSMessage) => {
      const payload = (msg as any).payload || msg
      if (payload && payload.online_users) {
        onlineUsers.value.clear()
        ;(payload.online_users as User[]).forEach((u) => {
          onlineUsers.value.set(u.id, {
            user: u,
            lastSeen: Date.now(),
            selection: null,
            cursorPosition: null,
          })
        })
      }
    })

    client.on('user-joined' as WSMessageType, (msg: WSMessage) => {
      const payload = (msg as any).payload || msg
      const user = payload.user || payload
      if (user && user.id) {
        onlineUsers.value.set(user.id, {
          user,
          lastSeen: Date.now(),
          selection: null,
          cursorPosition: null,
        })
      }
    })

    client.on('user-left' as WSMessageType, (msg: WSMessage) => {
      const payload = (msg as any).payload || msg
      const userId = payload.user_id || payload.userId
      if (userId) {
        onlineUsers.value.delete(userId)
      }
    })

    client.on('cursor-update' as WSMessageType, (msg: WSMessage) => {
      const payload = (msg as any).payload || msg
      const userId = payload.user_id || payload.userId
      if (userId) {
        const presence = onlineUsers.value.get(userId)
        if (presence) {
          presence.cursorPosition = payload.position || null
          presence.lastSeen = Date.now()
        }
      }
    })

    client.on('selection-update' as WSMessageType, (msg: WSMessage) => {
      const payload = (msg as any).payload || msg
      const userId = payload.user_id || payload.userId
      if (userId) {
        const presence = onlineUsers.value.get(userId)
        if (presence) {
          presence.selection = payload.selection || null
          presence.lastSeen = Date.now()
        }
      }
    })

    client.connect()
  }

  function disconnect() {
    const client = getWebSocketClient()
    if (client) {
      client.disconnect()
    }
    onlineUsers.value.clear()
    currentDatasetId.value = null
  }

  function sendCursorUpdate(position: { x: number; y: number; z: number } | null) {
    const client = getWebSocketClient()
    if (client && connectionStatus.value === 'connected') {
      client.send({
        type: 'cursor-update' as WSMessageType,
        timestamp: Date.now(),
        payload: { position },
      } as WSMessage)
    }
  }

  function sendSelectionUpdate(selection: any) {
    const client = getWebSocketClient()
    if (client && connectionStatus.value === 'connected') {
      client.send({
        type: 'selection-update' as WSMessageType,
        timestamp: Date.now(),
        payload: { selection },
      } as WSMessage)
    }
  }

  return {
    currentUser,
    onlineUsers,
    connectionStatus,
    currentDatasetId,
    isOnline,
    onlineUserCount,
    login,
    logout,
    connect,
    disconnect,
    sendCursorUpdate,
    sendSelectionUpdate,
  }
})

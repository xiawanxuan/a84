import type { Annotation, AnnotationVersion, AnnotationSelection } from './annotation'
import type { User } from './user'

export type WSMessageType =
  | 'auth'
  | 'auth-success'
  | 'auth-failed'
  | 'join-dataset'
  | 'leave-dataset'
  | 'user-joined'
  | 'user-left'
  | 'annotation-create'
  | 'annotation-update'
  | 'annotation-delete'
  | 'annotation-version'
  | 'selection-update'
  | 'cursor-update'
  | 'chat-message'
  | 'heartbeat'
  | 'error'

export interface WSMessageBase {
  type: WSMessageType
  timestamp: number
  requestId?: string
}

export interface WSAuthMessage extends WSMessageBase {
  type: 'auth'
  token: string
  datasetId: string
}

export interface WSAuthSuccessMessage extends WSMessageBase {
  type: 'auth-success'
  userId: string
  datasetId: string
  onlineUsers: User[]
}

export interface WSAuthFailedMessage extends WSMessageBase {
  type: 'auth-failed'
  reason: string
}

export interface WSJoinDatasetMessage extends WSMessageBase {
  type: 'join-dataset'
  datasetId: string
  user: User
}

export interface WSLeaveDatasetMessage extends WSMessageBase {
  type: 'leave-dataset'
  datasetId: string
  userId: string
}

export interface WSUserJoinedMessage extends WSMessageBase {
  type: 'user-joined'
  user: User
}

export interface WSUserLeftMessage extends WSMessageBase {
  type: 'user-left'
  userId: string
}

export interface WSAnnotationCreateMessage extends WSMessageBase {
  type: 'annotation-create'
  annotation: Annotation
  userId: string
}

export interface WSAnnotationUpdateMessage extends WSMessageBase {
  type: 'annotation-update'
  annotation: Annotation
  userId: string
}

export interface WSAnnotationDeleteMessage extends WSMessageBase {
  type: 'annotation-delete'
  annotationId: string
  userId: string
}

export interface WSAnnotationVersionMessage extends WSMessageBase {
  type: 'annotation-version'
  version: AnnotationVersion
  userId: string
}

export interface WSSelectionUpdateMessage extends WSMessageBase {
  type: 'selection-update'
  userId: string
  selection: AnnotationSelection
}

export interface WSCursorUpdateMessage extends WSMessageBase {
  type: 'cursor-update'
  userId: string
  position: { x: number; y: number; z: number } | null
}

export interface WSChatMessage extends WSMessageBase {
  type: 'chat-message'
  userId: string
  content: string
}

export interface WSHeartbeatMessage extends WSMessageBase {
  type: 'heartbeat'
}

export interface WSErrorMessage extends WSMessageBase {
  type: 'error'
  code: string
  message: string
}

export type WSMessage =
  | WSAuthMessage
  | WSAuthSuccessMessage
  | WSAuthFailedMessage
  | WSJoinDatasetMessage
  | WSLeaveDatasetMessage
  | WSUserJoinedMessage
  | WSUserLeftMessage
  | WSAnnotationCreateMessage
  | WSAnnotationUpdateMessage
  | WSAnnotationDeleteMessage
  | WSAnnotationVersionMessage
  | WSSelectionUpdateMessage
  | WSCursorUpdateMessage
  | WSChatMessage
  | WSHeartbeatMessage
  | WSErrorMessage

export type WSConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface WSUserPresence {
  user: User
  lastSeen: number
  selection: AnnotationSelection | null
  cursorPosition: { x: number; y: number; z: number } | null
}

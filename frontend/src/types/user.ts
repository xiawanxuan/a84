export interface User {
  id: string
  username: string
  displayName: string
  email?: string
  avatarUrl?: string
  color: string
  role: UserRole
}

export type UserRole = 'admin' | 'annotator' | 'reviewer' | 'viewer'

export interface UserPermissions {
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canReview: boolean
  canExport: boolean
  canManageUsers: boolean
}

export interface UserSession {
  user: User
  token: string
  expiresAt: number
  permissions: UserPermissions
}

export interface DatasetNode {
  id: string
  name: string
  type: 'folder' | 'dataset'
  children?: DatasetNode[]
  parentId?: string | null
  metadata?: {
    pointCount?: number
    annotationCount?: number
    status?: 'unannotated' | 'in-progress' | 'completed' | 'reviewed'
  }
}

export interface UserActivity {
  id: string
  userId: string
  action: 'create' | 'update' | 'delete' | 'review' | 'export' | 'login' | 'logout'
  targetType: 'annotation' | 'dataset' | 'user'
  targetId: string
  timestamp: string
  details?: string
}

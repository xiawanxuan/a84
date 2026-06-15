import type { Annotation, AnnotationStats } from '@/types/annotation'
import type { PointCloudMetadata } from '@/types/pointcloud'
import type { AnnotationCategory } from '@/types/annotation'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token') || ''
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  const json = await res.json()
  return json.data as T
}

export const pointcloudApi = {
  list: (page = 1, pageSize = 20, search = '') =>
    request<{ items: PointCloudMetadata[]; total: number }>(
      `/pointclouds?page=${page}&page_size=${pageSize}${search ? `&search=${search}` : ''}`
    ),

  get: (id: string) =>
    request<PointCloudMetadata>(`/pointclouds/${id}`),

  getTree: () =>
    request<any>('/pointclouds/tree'),

  create: (data: Partial<PointCloudMetadata>) =>
    request<PointCloudMetadata>('/pointclouds', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<PointCloudMetadata>) =>
    request<PointCloudMetadata>(`/pointclouds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/pointclouds/${id}`, { method: 'DELETE' }),

  getAnnotations: (pointcloudId: string) =>
    request<Annotation[]>(`/pointclouds/${pointcloudId}/annotations`),
}

export const annotationApi = {
  list: (pointcloudId: string, categoryId?: string) => {
    const params = categoryId ? `?category_id=${categoryId}` : ''
    return request<Annotation[]>(`/pointclouds/${pointcloudId}/annotations${params}`)
  },

  get: (id: string) =>
    request<Annotation>(`/annotations/${id}`),

  create: (pointcloudId: string, data: Partial<Annotation>) =>
    request<Annotation>(`/pointclouds/${pointcloudId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Annotation>) =>
    request<Annotation>(`/annotations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/annotations/${id}`, { method: 'DELETE' }),

  getStats: (pointcloudId: string) =>
    request<AnnotationStats>(`/pointclouds/${pointcloudId}/annotations/stats`),
}

export const categoryApi = {
  list: () =>
    request<AnnotationCategory[]>('/categories'),

  get: (id: string) =>
    request<AnnotationCategory>(`/categories/${id}`),

  create: (data: Partial<AnnotationCategory>) =>
    request<AnnotationCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<AnnotationCategory>) =>
    request<AnnotationCategory>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/categories/${id}`, { method: 'DELETE' }),
}

export const versionApi = {
  list: (annotationId: string) =>
    request<any[]>(`/annotations/${annotationId}/versions`),

  get: (annotationId: string, version: number) =>
    request<any>(`/annotations/${annotationId}/versions/${version}`),

  rollback: (annotationId: string, version: number) =>
    request<any>(`/annotations/${annotationId}/versions/${version}/rollback`, {
      method: 'POST',
    }),
}

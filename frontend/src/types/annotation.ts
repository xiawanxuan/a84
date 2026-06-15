import type { Point3D } from './pointcloud'

export interface AnnotationCategory {
  id: string
  name: string
  color: string
  parentId?: string | null
  description?: string
  order: number
}

export type AnnotationType = 'polygon' | 'bounding-box' | 'point' | 'polyline'

export interface AnnotationBase {
  id: string
  datasetId: string
  categoryId: string
  type: AnnotationType
  label?: string
  description?: string
  confidence?: number
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  version: number
  isDraft: boolean
}

export interface PolygonVertex extends Point3D {
  id: string
}

export interface PolygonAnnotation extends AnnotationBase {
  type: 'polygon'
  vertices: PolygonVertex[]
  isClosed: boolean
  height?: number
}

export interface BoundingBoxAnnotation extends AnnotationBase {
  type: 'bounding-box'
  position: Point3D
  size: Point3D
  rotation?: Point3D
}

export interface PointAnnotation extends AnnotationBase {
  type: 'point'
  position: Point3D
}

export interface PolylineAnnotation extends AnnotationBase {
  type: 'polyline'
  vertices: PolygonVertex[]
  isClosed: false
}

export type Annotation = PolygonAnnotation | BoundingBoxAnnotation | PointAnnotation | PolylineAnnotation

export interface AnnotationVersion {
  id: string
  annotationId: string
  version: number
  snapshot: Annotation
  createdBy: string
  createdAt: string
  message?: string
}

export interface AnnotationDraft {
  annotation: Annotation | null
  activeVertexIndex: number | null
  isValid: boolean
}

export interface AnnotationSelection {
  annotationId: string | null
  vertexId: string | null
}

export type AnnotationTool = 'select' | 'polygon' | 'bounding-box' | 'point' | 'polyline' | 'delete'

export interface AnnotationStats {
  total: number
  byCategory: Record<string, number>
  byType: Record<AnnotationType, number>
  drafts: number
}

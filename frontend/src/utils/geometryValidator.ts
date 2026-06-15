import type { Point3D } from '@/types/pointcloud'
import type { PolygonAnnotation, BoundingBoxAnnotation, Annotation } from '@/types/annotation'

const MIN_POLYGON_VERTICES = 3
const MIN_BOUNDING_BOX_SIZE = 0.01
const MAX_COORDINATE_VALUE = 1e6
const MIN_VERTEX_DISTANCE = 0.001

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateAnnotation(annotation: Annotation): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  }

  if (!annotation.id) {
    result.errors.push('标注ID不能为空')
    result.isValid = false
  }

  if (!annotation.datasetId) {
    result.errors.push('数据集ID不能为空')
    result.isValid = false
  }

  if (!annotation.categoryId) {
    result.errors.push('分类ID不能为空')
    result.isValid = false
  }

  if (!annotation.createdBy) {
    result.errors.push('创建者ID不能为空')
    result.isValid = false
  }

  switch (annotation.type) {
    case 'polygon':
      validatePolygon(annotation as PolygonAnnotation, result)
      break
    case 'bounding-box':
      validateBoundingBox(annotation as BoundingBoxAnnotation, result)
      break
    case 'point':
      validatePoint(annotation.position, result)
      break
    case 'polyline':
      validatePolyline(annotation.vertices, result)
      break
  }

  return result
}

export function validatePolygon(polygon: PolygonAnnotation, result: ValidationResult): void {
  const { vertices, isClosed } = polygon

  if (vertices.length < MIN_POLYGON_VERTICES) {
    result.errors.push(`多边形至少需要 ${MIN_POLYGON_VERTICES} 个顶点，当前有 ${vertices.length} 个`)
    result.isValid = false
    return
  }

  if (isClosed && vertices.length < MIN_POLYGON_VERTICES) {
    result.errors.push('闭合多边形至少需要3个顶点')
    result.isValid = false
  }

  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i]
    validateVertex(vertex, `顶点[${i}]`, result)
  }

  const duplicateIndices = findDuplicateVertices(vertices)
  if (duplicateIndices.length > 0) {
    result.warnings.push(`发现重复顶点，索引: ${duplicateIndices.join(', ')}`)
  }

  if (isSelfIntersecting(vertices)) {
    result.warnings.push('多边形可能存在自相交')
  }

  if (isClosed && calculatePolygonArea(vertices) < 0.0001) {
    result.warnings.push('多边形面积过小')
  }
}

export function validateBoundingBox(bbox: BoundingBoxAnnotation, result: ValidationResult): void {
  const { position, size } = bbox

  validateVertex(position, '位置', result)

  if (size.x < MIN_BOUNDING_BOX_SIZE) {
    result.errors.push(`包围盒宽度不能小于 ${MIN_BOUNDING_BOX_SIZE}，当前为 ${size.x}`)
    result.isValid = false
  }
  if (size.y < MIN_BOUNDING_BOX_SIZE) {
    result.errors.push(`包围盒高度不能小于 ${MIN_BOUNDING_BOX_SIZE}，当前为 ${size.y}`)
    result.isValid = false
  }
  if (size.z < MIN_BOUNDING_BOX_SIZE) {
    result.errors.push(`包围盒深度不能小于 ${MIN_BOUNDING_BOX_SIZE}，当前为 ${size.z}`)
    result.isValid = false
  }

  if (bbox.rotation) {
    validateVertex(bbox.rotation, '旋转', result)
  }
}

export function validatePolyline(vertices: Point3D[], result: ValidationResult): void {
  if (vertices.length < 2) {
    result.errors.push(`折线至少需要 2 个顶点，当前有 ${vertices.length} 个`)
    result.isValid = false
    return
  }

  for (let i = 0; i < vertices.length; i++) {
    validateVertex(vertices[i], `顶点[${i}]`, result)
  }
}

export function validatePoint(point: Point3D, result: ValidationResult): void {
  validateVertex(point, '点', result)
}

export function validateVertex(point: Point3D, name: string, result: ValidationResult): void {
  if (!isFinite(point.x) || !isFinite(point.y) || !isFinite(point.z)) {
    result.errors.push(`${name}坐标值必须是有限数字`)
    result.isValid = false
  }

  if (Math.abs(point.x) > MAX_COORDINATE_VALUE) {
    result.warnings.push(`${name} X坐标值 ${point.x} 超出合理范围`)
  }
  if (Math.abs(point.y) > MAX_COORDINATE_VALUE) {
    result.warnings.push(`${name} Y坐标值 ${point.y} 超出合理范围`)
  }
  if (Math.abs(point.z) > MAX_COORDINATE_VALUE) {
    result.warnings.push(`${name} Z坐标值 ${point.z} 超出合理范围`)
  }
}

export function findDuplicateVertices(vertices: Point3D[]): number[] {
  const duplicates: number[] = []

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (distance3D(vertices[i], vertices[j]) < MIN_VERTEX_DISTANCE) {
        if (!duplicates.includes(j)) {
          duplicates.push(j)
        }
      }
    }
  }

  return duplicates
}

export function isSelfIntersecting(vertices: Point3D[]): boolean {
  const n = vertices.length
  if (n < 4) return false

  for (let i = 0; i < n; i++) {
    const a1 = vertices[i]
    const a2 = vertices[(i + 1) % n]

    for (let j = i + 2; j < n; j++) {
      if (j === (i + 1) % n || i === (j + 1) % n) continue

      const b1 = vertices[j]
      const b2 = vertices[(j + 1) % n]

      if (lineSegmentsIntersect(a1, a2, b1, b2)) {
        return true
      }
    }
  }

  return false
}

export function lineSegmentsIntersect(
  p1: Point3D,
  p2: Point3D,
  p3: Point3D,
  p4: Point3D
): boolean {
  const d1 = direction(p3, p4, p1)
  const d2 = direction(p3, p4, p2)
  const d3 = direction(p1, p2, p3)
  const d4 = direction(p1, p2, p4)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  if (d1 === 0 && onSegment(p3, p4, p1)) return true
  if (d2 === 0 && onSegment(p3, p4, p2)) return true
  if (d3 === 0 && onSegment(p1, p2, p3)) return true
  if (d4 === 0 && onSegment(p1, p2, p4)) return true

  return false
}

export function calculatePolygonArea(vertices: Point3D[]): number {
  if (vertices.length < 3) return 0

  let area = 0
  const n = vertices.length

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i].x * vertices[j].z
    area -= vertices[j].x * vertices[i].z
  }

  return Math.abs(area) / 2
}

export function distance3D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function distance2D(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dz * dz)
}

function direction(p1: Point3D, p2: Point3D, p3: Point3D): number {
  return (p3.x - p1.x) * (p2.z - p1.z) - (p2.x - p1.x) * (p3.z - p1.z)
}

function onSegment(p1: Point3D, p2: Point3D, p: Point3D): boolean {
  return (
    Math.min(p1.x, p2.x) <= p.x && p.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.z, p2.z) <= p.z && p.z <= Math.max(p1.z, p2.z)
  )
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 255, g: 255, b: 255 }
}

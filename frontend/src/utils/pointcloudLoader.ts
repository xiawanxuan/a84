import * as THREE from 'three'
import type {
  PointCloudPoint,
  BoundingBox3D,
  OctreeNode,
  LODLevel,
  PointCloudLoadProgress,
  PointCloudMetadata
} from '@/types/pointcloud'

const OCTREE_MAX_POINTS_PER_NODE = 10000
const OCTREE_MAX_DEPTH = 8
const LOD_LEVELS: LODLevel[] = [
  { level: 0, pointCount: 100000, distanceThreshold: 0 },
  { level: 1, pointCount: 500000, distanceThreshold: 50 },
  { level: 2, pointCount: 2000000, distanceThreshold: 100 },
  { level: 3, pointCount: 5000000, distanceThreshold: 200 }
]

export function createBoundingBox(points: PointCloudPoint[]): BoundingBox3D {
  if (points.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 }
    }
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    minZ = Math.min(minZ, point.z)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
    maxZ = Math.max(maxZ, point.z)
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    },
    size: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ
    }
  }
}

export function buildOctree(
  points: PointCloudPoint[],
  bounds: BoundingBox3D,
  depth: number = 0,
  parentId: string = 'root'
): OctreeNode {
  const nodeId = parentId === 'root' ? 'root' : parentId
  const node: OctreeNode = {
    id: nodeId,
    level: depth,
    bounds,
    children: [],
    pointCount: points.length,
    hasGeometry: points.length > 0
  }

  if (points.length <= OCTREE_MAX_POINTS_PER_NODE || depth >= OCTREE_MAX_DEPTH) {
    return node
  }

  const childBounds = splitBounds(bounds)
  const childPoints: PointCloudPoint[][] = Array.from({ length: 8 }, () => [])

  for (const point of points) {
    const childIndex = getChildIndex(point, bounds.center)
    childPoints[childIndex].push(point)
  }

  for (let i = 0; i < 8; i++) {
    if (childPoints[i].length > 0) {
      const childNode = buildOctree(
        childPoints[i],
        childBounds[i],
        depth + 1,
        `${nodeId}-${i}`
      )
      node.children.push(childNode)
    }
  }

  return node
}

function splitBounds(bounds: BoundingBox3D): BoundingBox3D[] {
  const { min, max, center } = bounds
  return [
    createChildBounds(min, center),
    createChildBounds({ x: center.x, y: min.y, z: min.z }, { x: max.x, y: center.y, z: center.z }),
    createChildBounds({ x: min.x, y: center.y, z: min.z }, { x: center.x, y: max.y, z: center.z }),
    createChildBounds({ x: center.x, y: center.y, z: min.z }, { x: max.x, y: max.y, z: center.z }),
    createChildBounds({ x: min.x, y: min.y, z: center.z }, { x: center.x, y: center.y, z: max.z }),
    createChildBounds({ x: center.x, y: min.y, z: center.z }, { x: max.x, y: center.y, z: max.z }),
    createChildBounds({ x: min.x, y: center.y, z: center.z }, { x: center.x, y: max.y, z: max.z }),
    createChildBounds(center, max)
  ]
}

function createChildBounds(min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }): BoundingBox3D {
  return {
    min,
    max,
    center: {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    },
    size: {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z
    }
  }
}

function getChildIndex(point: PointCloudPoint, center: { x: number; y: number; z: number }): number {
  let index = 0
  if (point.x >= center.x) index |= 1
  if (point.y >= center.y) index |= 2
  if (point.z >= center.z) index |= 4
  return index
}

export function createPointsGeometry(
  points: PointCloudPoint[],
  lodLevel: number = 0
): THREE.BufferGeometry {
  const targetCount = LOD_LEVELS[lodLevel]?.pointCount || points.length
  const stride = Math.max(1, Math.floor(points.length / targetCount))
  const actualCount = Math.ceil(points.length / stride)

  const positions = new Float32Array(actualCount * 3)
  const colors = new Float32Array(actualCount * 3)
  const hasColors = points[0]?.color !== undefined

  let outputIndex = 0
  for (let i = 0; i < points.length; i += stride) {
    const point = points[i]
    const posIdx = outputIndex * 3
    positions[posIdx] = point.x
    positions[posIdx + 1] = point.y
    positions[posIdx + 2] = point.z

    if (hasColors && point.color) {
      colors[posIdx] = point.color.r / 255
      colors[posIdx + 1] = point.color.g / 255
      colors[posIdx + 2] = point.color.b / 255
    } else {
      const intensity = point.intensity !== undefined ? point.intensity / 255 : 0.8
      colors[posIdx] = intensity
      colors[posIdx + 1] = intensity
      colors[posIdx + 2] = intensity
    }
    outputIndex++
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()

  return geometry
}

export function createPointsMaterial(size: number = 0.1): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    size,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: false,
    opacity: 1.0,
    depthWrite: true,
    depthTest: true
  })
}

export async function loadPointCloudFromURL(
  url: string,
  datasetId: string,
  onProgress?: (progress: PointCloudLoadProgress) => void
): Promise<{ points: PointCloudPoint[]; metadata: PointCloudMetadata }> {
  const reportProgress = (loaded: number, total: number, stage: PointCloudLoadProgress['stage']) => {
    onProgress?.({
      loaded,
      total,
      percentage: total > 0 ? (loaded / total) * 100 : 0,
      stage
    })
  }

  reportProgress(0, 1, 'download')
  const response = await fetch(url)
  const reader = response.body?.getReader()
  const contentLength = Number(response.headers.get('Content-Length')) || 0

  let receivedLength = 0
  const chunks: Uint8Array[] = []

  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      receivedLength += value.length
      reportProgress(receivedLength, contentLength || receivedLength, 'download')
    }
  }

  const data = new Uint8Array(receivedLength)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.length
  }

  reportProgress(0, 1, 'parse')
  const points = parseXYZData(data)

  reportProgress(0, 1, 'build-octree')
  const bounds = createBoundingBox(points)

  const metadata: PointCloudMetadata = {
    id: datasetId,
    name: url.split('/').pop() || 'pointcloud',
    totalPoints: points.length,
    bounds,
    format: 'xyz',
    hasColors: points[0]?.color !== undefined,
    hasIntensity: points[0]?.intensity !== undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  reportProgress(1, 1, 'ready')
  return { points, metadata }
}

function parseXYZData(data: Uint8Array): PointCloudPoint[] {
  const text = new TextDecoder().decode(data)
  const lines = text.trim().split('\n')
  const points: PointCloudPoint[] = []

  for (const line of lines) {
    const parts = line.trim().split(/[\s,]+/)
    if (parts.length < 3) continue

    const x = parseFloat(parts[0])
    const y = parseFloat(parts[1])
    const z = parseFloat(parts[2])

    if (isNaN(x) || isNaN(y) || isNaN(z)) continue

    const point: PointCloudPoint = { x, y, z }

    if (parts.length >= 6) {
      const r = parseInt(parts[3])
      const g = parseInt(parts[4])
      const b = parseInt(parts[5])
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        point.color = { r, g, b }
      }
    }

    if (parts.length >= 4 && !point.color) {
      const intensity = parseFloat(parts[3])
      if (!isNaN(intensity)) {
        point.intensity = intensity
      }
    }

    points.push(point)
  }

  return points
}

export function generateSamplePointCloud(count: number = 100000): PointCloudPoint[] {
  const points: PointCloudPoint[] = []

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 10 + Math.random() * 40
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 5
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 5
    const y = Math.random() * 30

    const treeHeight = 15 + Math.random() * 15
    const inTrunk = y < 3
    const inCanopy = y > treeHeight - 8 && y < treeHeight + 2

    let r: number, g: number, b: number
    if (inTrunk) {
      r = 101 + Math.random() * 30
      g = 67 + Math.random() * 20
      b = 33 + Math.random() * 15
    } else if (inCanopy) {
      r = 34 + Math.random() * 30
      g = 100 + Math.random() * 60
      b = 34 + Math.random() * 20
    } else {
      r = 80 + Math.random() * 40
      g = 80 + Math.random() * 40
      b = 80 + Math.random() * 40
    }

    points.push({
      x,
      y,
      z,
      color: { r, g, b }
    })
  }

  return points
}

export function getLODLevels(): LODLevel[] {
  return [...LOD_LEVELS]
}

export interface Point3D {
  x: number
  y: number
  z: number
}

export interface PointColor {
  r: number
  g: number
  b: number
  a?: number
}

export interface PointCloudPoint extends Point3D {
  color?: PointColor
  intensity?: number
  classification?: number
}

export interface BoundingBox3D {
  min: Point3D
  max: Point3D
  center: Point3D
  size: Point3D
}

export interface OctreeNode {
  id: string
  level: number
  bounds: BoundingBox3D
  children: OctreeNode[]
  pointCount: number
  hasGeometry: boolean
}

export interface LODLevel {
  level: number
  pointCount: number
  distanceThreshold: number
}

export interface PointCloudMetadata {
  id: string
  name: string
  totalPoints: number
  bounds: BoundingBox3D
  format: 'las' | 'laz' | 'ply' | 'xyz' | 'pcd'
  hasColors: boolean
  hasIntensity: boolean
  createdAt: string
  updatedAt: string
}

export interface PointCloudDataset {
  id: string
  name: string
  metadata: PointCloudMetadata
  octreeRoot: OctreeNode | null
  lodLevels: LODLevel[]
  loaded: boolean
  loading: boolean
}

export interface PointCloudLoadProgress {
  loaded: number
  total: number
  percentage: number
  stage: 'download' | 'parse' | 'build-octree' | 'ready'
}

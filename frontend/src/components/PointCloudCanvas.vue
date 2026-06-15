<template>
  <div class="pointcloud-canvas" ref="canvasContainer">
    <canvas ref="canvasEl"></canvas>
    <div class="canvas-overlay" v-if="loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingText }}</div>
    </div>
    <div class="canvas-info">
      <span v-if="pointCount">点数: {{ formatCount(pointCount) }}</span>
      <span v-if="fps">FPS: {{ fps }}</span>
    </div>
    <div class="canvas-controls">
      <button @click="resetCamera" title="重置视角">⌂</button>
      <button @click="toggleTopView" title="俯视图">⊤</button>
      <button @click="toggleSideView" title="侧视图">◫</button>
      <button @click="togglePointSize" title="点大小">{{ pointSizeLabel }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { usePointcloudStore } from '@/stores/pointcloud'
import { useAnnotationStore } from '@/stores/annotation'
import { useCollabStore } from '@/stores/collab'
import {
  createPointsGeometry,
  createPointsMaterial,
  generateSamplePointCloud,
  loadPointCloudFromURL,
} from '@/utils/pointcloudLoader'
import type { PointCloudPoint, PointCloudLoadProgress } from '@/types/pointcloud'
import type { PolygonVertex } from '@/types/annotation'

const props = defineProps<{
  datasetId?: string
}>()

const emit = defineEmits<{
  vertexAdded: [vertex: { x: number; y: number; z: number }]
  canvasClick: [point: THREE.Vector3]
}>()

const pointcloudStore = usePointcloudStore()
const annotationStore = useAnnotationStore()
const collabStore = useCollabStore()

const canvasContainer = ref<HTMLDivElement>()
const canvasEl = ref<HTMLCanvasElement>()
const loading = ref(false)
const loadingText = ref('加载中...')
const pointCount = ref(0)
const fps = ref(0)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let pointCloud: THREE.Points | null = null
let annotationGroup: THREE.Group
let draftGroup: THREE.Group
let remoteCursorGroup: THREE.Group
let animationFrameId: number
let clock: THREE.Clock
let frameCount = 0
let lastFpsTime = 0

const pointSizes = [0.1, 0.25, 0.5, 1.0, 2.0]
const pointSizeIndex = ref(1)
const pointSizeLabel = ref('●')

function initThree() {
  if (!canvasContainer.value || !canvasEl.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0d1117)

  const rect = canvasContainer.value.getBoundingClientRect()
  camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 0.1, 10000)
  camera.position.set(50, 50, 50)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasEl.value,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setSize(rect.width, rect.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  controls = new OrbitControls(camera, canvasEl.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.8
  controls.panSpeed = 0.8
  controls.zoomSpeed = 1.2
  controls.minDistance = 1
  controls.maxDistance = 2000
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(100, 200, 50)
  scene.add(dirLight)

  const gridHelper = new THREE.GridHelper(200, 40, 0x2d3139, 0x1a1d23)
  scene.add(gridHelper)

  annotationGroup = new THREE.Group()
  annotationGroup.name = 'annotations'
  scene.add(annotationGroup)

  draftGroup = new THREE.Group()
  draftGroup.name = 'draft'
  scene.add(draftGroup)

  remoteCursorGroup = new THREE.Group()
  remoteCursorGroup.name = 'remote-cursors'
  scene.add(remoteCursorGroup)

  clock = new THREE.Clock()

  canvasEl.value.addEventListener('click', onCanvasClick)
  canvasEl.value.addEventListener('touchend', onCanvasTouchEnd)
  window.addEventListener('resize', onResize)

  animate()
}

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)

  frameCount++
  const elapsed = clock.getElapsedTime()
  if (elapsed - lastFpsTime >= 1) {
    fps.value = frameCount
    frameCount = 0
    lastFpsTime = elapsed
  }
}

function onResize() {
  if (!canvasContainer.value) return
  const rect = canvasContainer.value.getBoundingClientRect()
  camera.aspect = rect.width / rect.height
  camera.updateProjectionMatrix()
  renderer.setSize(rect.width, rect.height)
}

function onCanvasClick(event: MouseEvent) {
  if (annotationStore.activeTool === 'select') return

  const point = getIntersectionPoint(event)
  if (!point) return

  if (annotationStore.activeTool === 'polygon' || annotationStore.activeTool === 'polyline') {
    annotationStore.addDraftVertex({ x: point.x, y: point.y, z: point.z })
    updateDraftVisualization()
    emit('vertexAdded', { x: point.x, y: point.y, z: point.z })
  }
}

function onCanvasTouchEnd(event: TouchEvent) {
  if (event.touches.length !== 1) return
  if (annotationStore.activeTool === 'select') return

  const touch = event.changedTouches[0]
  const point = getIntersectionPointFromCoords(touch.clientX, touch.clientY)
  if (!point) return

  if (annotationStore.activeTool === 'polygon' || annotationStore.activeTool === 'polyline') {
    annotationStore.addDraftVertex({ x: point.x, y: point.y, z: point.z })
    updateDraftVisualization()
    emit('vertexAdded', { x: point.x, y: point.y, z: point.z })
  }
}

function getIntersectionPoint(event: MouseEvent): THREE.Vector3 | null {
  return getIntersectionPointFromCoords(event.clientX, event.clientY)
}

function getIntersectionPointFromCoords(clientX: number, clientY: number): THREE.Vector3 | null {
  if (!canvasContainer.value) return null
  const rect = canvasContainer.value.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.params.Points.threshold = 0.5
  raycaster.setFromCamera(mouse, camera)

  if (pointCloud) {
    const intersects = raycaster.intersectObject(pointCloud)
    if (intersects.length > 0) {
      return intersects[0].point
    }
  }

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const target = new THREE.Vector3()
  raycaster.ray.intersectPlane(plane, target)
  return target
}

function loadPoints(points: PointCloudPoint[]) {
  if (pointCloud) {
    scene.remove(pointCloud)
    pointCloud.geometry.dispose()
    ;(pointCloud.material as THREE.Material).dispose()
  }

  const geometry = createPointsGeometry(points, 0)
  const material = createPointsMaterial(pointSizes[pointSizeIndex.value])
  pointCloud = new THREE.Points(geometry, material)
  pointCloud.name = 'pointcloud'
  scene.add(pointCloud)

  pointCount.value = points.length

  geometry.computeBoundingSphere()
  if (geometry.boundingSphere) {
    const center = geometry.boundingSphere.center
    const radius = geometry.boundingSphere.radius
    controls.target.copy(center)
    camera.position.set(center.x + radius, center.y + radius * 0.5, center.z + radius)
    controls.update()
  }
}

function updateDraftVisualization() {
  while (draftGroup.children.length > 0) {
    const child = draftGroup.children[0]
    draftGroup.remove(child)
    if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
      child.geometry.dispose()
      ;(child.material as THREE.Material).dispose()
    }
  }

  const draft = annotationStore.currentDraft
  if (!draft?.annotation) return
  if (draft.annotation.type !== 'polygon' && draft.annotation.type !== 'polyline') return

  const vertices = (draft.annotation as any).vertices as PolygonVertex[]
  if (vertices.length === 0) return

  const positions: THREE.Vector3[] = vertices.map((v) => new THREE.Vector3(v.x, v.y, v.z))

  const lineGeo = new THREE.BufferGeometry().setFromPoints(positions)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x58a6ff, linewidth: 2 })
  draftGroup.add(new THREE.Line(lineGeo, lineMat))

  vertices.forEach((v) => {
    const sphereGeo = new THREE.SphereGeometry(0.3, 8, 8)
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x58a6ff })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.position.set(v.x, v.y, v.z)
    draftGroup.add(sphere)
  })

  if (draft.annotation.type === 'polygon' && draft.annotation.isClosed && vertices.length >= 3) {
    const shape = new THREE.Shape()
    shape.moveTo(vertices[0].x, vertices[0].z)
    for (let i = 1; i < vertices.length; i++) {
      shape.lineTo(vertices[i].x, vertices[i].z)
    }
    shape.closePath()

    const shapeGeo = new THREE.ShapeGeometry(shape)
    const shapeMat = new THREE.MeshBasicMaterial({
      color: 0x58a6ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(shapeGeo, shapeMat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.1
    draftGroup.add(mesh)
  }
}

function renderAnnotation(annotation: any) {
  const key = `annotation-${annotation.id}`
  const existing = annotationGroup.getObjectByName(key)
  if (existing) {
    annotationGroup.remove(existing)
    if (existing instanceof THREE.Line || existing instanceof THREE.Mesh) {
      existing.geometry.dispose()
      ;(existing.material as THREE.Material).dispose()
    }
  }

  if (!annotation.vertices || annotation.vertices.length < 2) return

  const category = annotationStore.categories.find((c) => c.id === annotation.categoryId)
  const color = category?.color ? new THREE.Color(category.color) : new THREE.Color(0x58a6ff)

  const positions = annotation.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, v.z))
  const lineGeo = new THREE.BufferGeometry().setFromPoints(positions)
  const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 })
  const line = new THREE.Line(lineGeo, lineMat)
  line.name = key
  annotationGroup.add(line)

  if (annotation.type === 'polygon' && annotation.isClosed && annotation.vertices.length >= 3) {
    const shape = new THREE.Shape()
    shape.moveTo(annotation.vertices[0].x, annotation.vertices[0].z)
    for (let i = 1; i < annotation.vertices.length; i++) {
      shape.lineTo(annotation.vertices[i].x, annotation.vertices[i].z)
    }
    shape.closePath()
    const shapeGeo = new THREE.ShapeGeometry(shape)
    const shapeMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(shapeGeo, shapeMat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.1
    mesh.name = key
    annotationGroup.add(mesh)
  }
}

function resetCamera() {
  if (pointCloud?.geometry.boundingSphere) {
    const center = pointCloud.geometry.boundingSphere.center
    const radius = pointCloud.geometry.boundingSphere.radius
    controls.target.copy(center)
    camera.position.set(center.x + radius, center.y + radius * 0.5, center.z + radius)
    controls.update()
  }
}

function toggleTopView() {
  if (pointCloud?.geometry.boundingSphere) {
    const center = pointCloud.geometry.boundingSphere.center
    const radius = pointCloud.geometry.boundingSphere.radius
    controls.target.copy(center)
    camera.position.set(center.x, center.y + radius * 2, center.z)
    camera.up.set(0, 0, -1)
    controls.update()
  }
}

function toggleSideView() {
  if (pointCloud?.geometry.boundingSphere) {
    const center = pointCloud.geometry.boundingSphere.center
    const radius = pointCloud.geometry.boundingSphere.radius
    controls.target.copy(center)
    camera.position.set(center.x, center.y, center.z + radius * 2)
    camera.up.set(0, 1, 0)
    controls.update()
  }
}

function togglePointSize() {
  pointSizeIndex.value = (pointSizeIndex.value + 1) % pointSizes.length
  const labels = ['·', '●', '⬤', '◉', '⬤']
  pointSizeLabel.value = labels[pointSizeIndex.value]
  if (pointCloud) {
    ;(pointCloud.material as THREE.PointsMaterial).size = pointSizes[pointSizeIndex.value]
  }
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M'
  if (count >= 1_000) return (count / 1_000).toFixed(1) + 'K'
  return String(count)
}

watch(
  () => props.datasetId,
  async (newId) => {
    if (!newId) return
    loading.value = true
    loadingText.value = '生成示例点云...'
    try {
      const points = generateSamplePointCloud(500000)
      loadPoints(points)
      pointcloudStore.setDatasetLoaded(newId)
      collabStore.connect(newId)
      await annotationStore.fetchAnnotations(newId)
      annotationStore.annotations.forEach((a) => renderAnnotation(a))
    } catch (e) {
      console.error('load pointcloud failed:', e)
    } finally {
      loading.value = false
    }
  }
)

watch(
  () => annotationStore.annotations,
  () => {
    annotationStore.annotations.forEach((a) => renderAnnotation(a))
  },
  { deep: true }
)

onMounted(() => {
  nextTick(() => {
    initThree()
    if (props.datasetId) {
      loading.value = true
      loadingText.value = '生成示例点云...'
      generateSamplePointCloud(500000).then((points) => {
        loadPoints(points)
        pointcloudStore.setDatasetLoaded(props.datasetId!)
        loading.value = false
      })
    }
  })
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', onResize)
  if (renderer) renderer.dispose()
  if (controls) controls.dispose()
})

defineExpose({
  resetCamera,
  loadPoints,
})
</script>

<style scoped>
.pointcloud-canvas {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #0d1117;
}
.pointcloud-canvas canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.canvas-overlay {
  position: absolute;
  inset: 0;
  background: rgba(13, 17, 23, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #2d3139;
  border-top-color: #58a6ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text {
  margin-top: 12px;
  color: #8b949e;
  font-size: 14px;
}
.canvas-info {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  gap: 12px;
  color: #484f58;
  font-size: 11px;
  z-index: 5;
}
.canvas-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 5;
}
.canvas-controls button {
  width: 32px;
  height: 32px;
  background: rgba(33, 38, 45, 0.9);
  border: 1px solid #2d3139;
  color: #8b949e;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.canvas-controls button:hover {
  background: #21262d;
  color: #e0e0e0;
  border-color: #58a6ff;
}
</style>

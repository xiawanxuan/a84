import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Annotation,
  AnnotationCategory,
  AnnotationDraft,
  AnnotationTool,
  AnnotationStats,
} from '@/types/annotation'
import { annotationApi, categoryApi } from '@/api'
import { getLocalDraftCache } from '@/utils/localDraftCache'
import { generateId } from '@/utils/geometryValidator'

export const useAnnotationStore = defineStore('annotation', () => {
  const annotations = ref<Map<string, Annotation>>(new Map())
  const categories = ref<AnnotationCategory[]>([])
  const selectedId = ref<string | null>(null)
  const activeTool = ref<AnnotationTool>('select')
  const currentDraft = ref<AnnotationDraft | null>(null)
  const activeCategoryId = ref<string | null>(null)
  const stats = ref<AnnotationStats | null>(null)

  const selectedAnnotation = computed(() => {
    if (!selectedId.value) return null
    return annotations.value.get(selectedId.value) || null
  })

  const annotationsByDataset = computed(() => {
    const map = new Map<string, Annotation[]>()
    annotations.value.forEach((a) => {
      const list = map.get(a.datasetId) || []
      list.push(a)
      map.set(a.datasetId, list)
    })
    return map
  })

  async function fetchCategories() {
    try {
      const result = await categoryApi.list()
      categories.value = result
      if (!activeCategoryId.value && result.length > 0) {
        activeCategoryId.value = result[0].id
      }
    } catch (e) {
      console.error('fetch categories failed:', e)
    }
  }

  async function fetchAnnotations(datasetId: string) {
    try {
      const result = await annotationApi.list(datasetId)
      annotations.value.clear()
      result.forEach((a) => annotations.value.set(a.id, a))
    } catch (e) {
      console.error('fetch annotations failed:', e)
    }
  }

  async function createAnnotation(datasetId: string, data: Partial<Annotation>) {
    try {
      const created = await annotationApi.create(datasetId, data)
      annotations.value.set(created.id, created)
      getLocalDraftCache().removeDraft(datasetId, data.id || '')
      return created
    } catch (e) {
      console.error('create annotation failed:', e)
      throw e
    }
  }

  async function updateAnnotation(id: string, data: Partial<Annotation>) {
    try {
      const updated = await annotationApi.update(id, data)
      annotations.value.set(id, updated)
      return updated
    } catch (e) {
      console.error('update annotation failed:', e)
      throw e
    }
  }

  async function deleteAnnotation(id: string) {
    try {
      await annotationApi.delete(id)
      annotations.value.delete(id)
      if (selectedId.value === id) {
        selectedId.value = null
      }
    } catch (e) {
      console.error('delete annotation failed:', e)
    }
  }

  function setActiveTool(tool: AnnotationTool) {
    activeTool.value = tool
    if (tool !== 'polygon' && tool !== 'polyline') {
      currentDraft.value = null
    }
  }

  function selectAnnotation(id: string | null) {
    selectedId.value = id
  }

  function setActiveCategory(id: string) {
    activeCategoryId.value = id
  }

  function startDraft(datasetId: string) {
    if (!activeCategoryId.value) return
    const draft: Annotation = {
      id: generateId(),
      datasetId,
      categoryId: activeCategoryId.value,
      type: activeTool.value === 'polygon' ? 'polygon' : 'polyline',
      vertices: [],
      isClosed: false,
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedBy: '',
      updatedAt: new Date().toISOString(),
      version: 0,
      isDraft: true,
    }
    currentDraft.value = {
      annotation: draft,
      activeVertexIndex: null,
      isValid: false,
    }
  }

  function saveDraft() {
    if (!currentDraft.value?.annotation) return
    const { annotation } = currentDraft.value
    getLocalDraftCache().saveDraft(annotation.datasetId, annotation)
  }

  function addDraftVertex(vertex: { x: number; y: number; z: number }) {
    if (!currentDraft.value?.annotation) return
    const ann = currentDraft.value.annotation
    if (ann.type === 'polygon' || ann.type === 'polyline') {
      ann.vertices.push({ ...vertex, id: generateId() })
      currentDraft.value.activeVertexIndex = ann.vertices.length - 1
      currentDraft.value.isValid =
        ann.type === 'polygon' ? ann.vertices.length >= 3 : ann.vertices.length >= 2
      saveDraft()
    }
  }

  function closeDraft() {
    if (!currentDraft.value?.annotation) return
    if (currentDraft.value.annotation.type === 'polygon') {
      currentDraft.value.annotation.isClosed = true
    }
    saveDraft()
  }

  function clearDraft() {
    currentDraft.value = null
  }

  function receiveRemoteAnnotation(annotation: Annotation) {
    annotations.value.set(annotation.id, annotation)
  }

  function removeRemoteAnnotation(annotationId: string) {
    annotations.value.delete(annotationId)
    if (selectedId.value === annotationId) {
      selectedId.value = null
    }
  }

  return {
    annotations,
    categories,
    selectedId,
    activeTool,
    currentDraft,
    activeCategoryId,
    stats,
    selectedAnnotation,
    annotationsByDataset,
    fetchCategories,
    fetchAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setActiveTool,
    selectAnnotation,
    setActiveCategory,
    startDraft,
    saveDraft,
    addDraftVertex,
    closeDraft,
    clearDraft,
    receiveRemoteAnnotation,
    removeRemoteAnnotation,
  }
})

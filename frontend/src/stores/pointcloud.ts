import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PointCloudDataset } from '@/types/pointcloud'
import type { DatasetNode } from '@/types/user'
import { pointcloudApi } from '@/api'

export const usePointcloudStore = defineStore('pointcloud', () => {
  const datasets = ref<Map<string, PointCloudDataset>>(new Map())
  const activeDatasetId = ref<string | null>(null)
  const treeNodes = ref<DatasetNode[]>([])
  const loading = ref(false)

  const activeDataset = computed(() => {
    if (!activeDatasetId.value) return null
    return datasets.value.get(activeDatasetId.value) || null
  })

  const datasetList = computed(() => Array.from(datasets.value.values()))

  async function fetchTree() {
    loading.value = true
    try {
      const result = await pointcloudApi.getTree()
      if (result && result.children) {
        treeNodes.value = result.children
      }
    } catch (e) {
      console.error('fetch tree failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function loadDataset(id: string) {
    const existing = datasets.value.get(id)
    if (existing?.loaded) {
      activeDatasetId.value = id
      return
    }

    loading.value = true
    try {
      const metadata = await pointcloudApi.get(id)
      const dataset: PointCloudDataset = {
        id: metadata.id,
        name: metadata.name,
        metadata,
        octreeRoot: null,
        lodLevels: [],
        loaded: false,
        loading: true,
      }
      datasets.value.set(id, dataset)
      activeDatasetId.value = id
    } catch (e) {
      console.error('load dataset failed:', e)
    } finally {
      loading.value = false
    }
  }

  function setActiveDataset(id: string | null) {
    activeDatasetId.value = id
  }

  function setDatasetLoaded(id: string) {
    const ds = datasets.value.get(id)
    if (ds) {
      ds.loaded = true
      ds.loading = false
    }
  }

  return {
    datasets,
    activeDatasetId,
    activeDataset,
    datasetList,
    treeNodes,
    loading,
    fetchTree,
    loadDataset,
    setActiveDataset,
    setDatasetLoaded,
  }
})

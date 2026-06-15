<template>
  <div class="main-layout">
    <DatasetTree />
    <div class="center-area">
      <PointCloudCanvas
        :dataset-id="pointcloudStore.activeDatasetId || undefined"
        @vertex-added="onVertexAdded"
      />
      <StatusBar />
    </div>
    <AnnotationToolbar />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import DatasetTree from '@/components/DatasetTree.vue'
import PointCloudCanvas from '@/components/PointCloudCanvas.vue'
import AnnotationToolbar from '@/components/AnnotationToolbar.vue'
import StatusBar from '@/components/StatusBar.vue'
import { usePointcloudStore } from '@/stores/pointcloud'
import { useAnnotationStore } from '@/stores/annotation'
import { useCollabStore } from '@/stores/collab'

const pointcloudStore = usePointcloudStore()
const annotationStore = useAnnotationStore()
const collabStore = useCollabStore()

function onVertexAdded(vertex: { x: number; y: number; z: number }) {
  collabStore.sendCursorUpdate(vertex)
}

onMounted(() => {
  annotationStore.fetchCategories()
})
</script>

<style scoped>
.main-layout {
  width: 100%;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background: #0d1117;
}
.center-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
</style>

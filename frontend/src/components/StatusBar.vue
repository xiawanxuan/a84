<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-item" v-if="pointcloudStore.activeDataset">
        {{ pointcloudStore.activeDataset.name }}
      </span>
      <span class="status-item" v-if="annotationCount > 0">
        标注: {{ annotationCount }}
      </span>
      <span class="status-item draft" v-if="draftCount > 0">
        草稿: {{ draftCount }}
      </span>
    </div>
    <div class="status-center">
      <span class="status-item tool" v-if="annotationStore.activeTool !== 'select'">
        当前工具: {{ currentToolLabel }}
      </span>
    </div>
    <div class="status-right">
      <span class="status-item collab" :class="collabStore.connectionStatus">
        {{ connectionIcon }} {{ collabStore.onlineUserCount }}
      </span>
      <span class="status-item" v-if="collabStore.currentUser">
        {{ collabStore.currentUser.username || collabStore.currentUser.displayName }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePointcloudStore } from '@/stores/pointcloud'
import { useAnnotationStore } from '@/stores/annotation'
import { useCollabStore } from '@/stores/collab'
import { getLocalDraftCache } from '@/utils/localDraftCache'

const pointcloudStore = usePointcloudStore()
const annotationStore = useAnnotationStore()
const collabStore = useCollabStore()

const annotationCount = computed(() => annotationStore.annotations.size)
const draftCount = computed(() =>
  pointcloudStore.activeDatasetId
    ? getLocalDraftCache().getDraftCount(pointcloudStore.activeDatasetId)
    : 0
)

const currentToolLabel = computed(() => {
  const map: Record<string, string> = {
    select: '选择',
    polygon: '多边形',
    'bounding-box': '包围盒',
    point: '点标注',
    polyline: '折线',
    delete: '删除',
  }
  return map[annotationStore.activeTool] || annotationStore.activeTool
})

const connectionIcon = computed(() => {
  return collabStore.connectionStatus === 'connected' ? '🟢' : '🔴'
})
</script>

<style scoped>
.status-bar {
  height: 24px;
  background: #161b22;
  border-top: 1px solid #2d3139;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 11px;
  color: #8b949e;
  user-select: none;
  flex-shrink: 0;
}
.status-left, .status-center, .status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-item.draft { color: #d29922; }
.status-item.tool { color: #58a6ff; }
.status-item.collab.connected { color: #3fb950; }
.status-item.collab.disconnected { color: #484f58; }
</style>

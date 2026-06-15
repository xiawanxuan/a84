<template>
  <div class="annotation-toolbar">
    <div class="toolbar-section">
      <h4 class="section-title">标注工具</h4>
      <div class="tool-grid">
        <button
          v-for="tool in tools"
          :key="tool.id"
          class="tool-btn"
          :class="{ active: annotationStore.activeTool === tool.id }"
          @click="annotationStore.setActiveTool(tool.id)"
          :title="tool.label"
        >
          <span class="tool-icon">{{ tool.icon }}</span>
          <span class="tool-label">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar-section">
      <h4 class="section-title">植被分类</h4>
      <div class="category-list">
        <button
          v-for="cat in annotationStore.categories"
          :key="cat.id"
          class="category-btn"
          :class="{ active: annotationStore.activeCategoryId === cat.id }"
          @click="annotationStore.setActiveCategory(cat.id)"
        >
          <span class="category-color" :style="{ backgroundColor: cat.color }"></span>
          <span class="category-name">{{ cat.name }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar-section">
      <h4 class="section-title">草稿操作</h4>
      <div class="draft-actions">
        <button
          class="action-btn"
          @click="handleFinishDraft"
          :disabled="!canFinishDraft"
          title="完成多边形"
        >
          ✓ 完成
        </button>
        <button
          class="action-btn"
          @click="handleUndoVertex"
          :disabled="!canUndoVertex"
          title="撤销顶点"
        >
          ↩ 撤销
        </button>
        <button
          class="action-btn danger"
          @click="handleCancelDraft"
          :disabled="!annotationStore.currentDraft"
          title="取消标注"
        >
          ✕ 取消
        </button>
      </div>
    </div>

    <div class="toolbar-section" v-if="annotationStore.selectedAnnotation">
      <h4 class="section-title">选中标注</h4>
      <div class="selected-info">
        <span class="info-label">{{ getSelectedLabel() }}</span>
        <span class="info-version">v{{ annotationStore.selectedAnnotation.version }}</span>
      </div>
      <div class="annotation-actions">
        <button class="action-btn" @click="handleDeleteSelected">删除</button>
        <button class="action-btn" @click="handleRollbackSelected">回滚版本</button>
      </div>
    </div>

    <div class="toolbar-section">
      <h4 class="section-title">协同状态</h4>
      <div class="collab-info">
        <span class="collab-status" :class="collabStore.connectionStatus">
          {{ connectionLabel }}
        </span>
        <span v-if="collabStore.onlineUserCount > 0" class="collab-users">
          {{ collabStore.onlineUserCount }} 人在线
        </span>
      </div>
      <div class="online-users" v-if="collabStore.onlineUserCount > 0">
        <div
          v-for="[userId, presence] of collabStore.onlineUsers"
          :key="userId"
          class="online-user"
        >
          <span class="user-color" :style="{ backgroundColor: presence.user.color }"></span>
          <span class="user-name">{{ presence.user.username || presence.user.displayName }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAnnotationStore } from '@/stores/annotation'
import { usePointcloudStore } from '@/stores/pointcloud'
import { useCollabStore } from '@/stores/collab'
import { versionApi } from '@/api'
import type { AnnotationTool } from '@/types/annotation'

const annotationStore = useAnnotationStore()
const pointcloudStore = usePointcloudStore()
const collabStore = useCollabStore()

const tools: { id: AnnotationTool; icon: string; label: string }[] = [
  { id: 'select', icon: '☝', label: '选择' },
  { id: 'polygon', icon: '⬡', label: '多边形' },
  { id: 'bounding-box', icon: '▭', label: '包围盒' },
  { id: 'point', icon: '◉', label: '点标注' },
  { id: 'polyline', icon: '⌇', label: '折线' },
  { id: 'delete', icon: '✕', label: '删除' },
]

const canFinishDraft = computed(() => {
  const draft = annotationStore.currentDraft
  return draft?.annotation?.type === 'polygon' && !draft.annotation.isClosed && draft.isValid
})

const canUndoVertex = computed(() => {
  const draft = annotationStore.currentDraft
  if (!draft?.annotation) return false
  const vertices = (draft.annotation as any).vertices
  return vertices && vertices.length > 0
})

const connectionLabel = computed(() => {
  const map: Record<string, string> = {
    connected: '已连接',
    connecting: '连接中',
    disconnected: '未连接',
    reconnecting: '重连中',
    error: '连接错误',
  }
  return map[collabStore.connectionStatus] || collabStore.connectionStatus
})

async function handleFinishDraft() {
  annotationStore.closeDraft()
  const draft = annotationStore.currentDraft
  if (!draft?.annotation) return

  const datasetId = pointcloudStore.activeDatasetId
  if (!datasetId) return

  try {
    await annotationStore.createAnnotation(datasetId, draft.annotation)
    annotationStore.clearDraft()
  } catch (e) {
    console.error('submit annotation failed:', e)
  }
}

function handleUndoVertex() {
  const draft = annotationStore.currentDraft
  if (!draft?.annotation) return
  const vertices = (draft.annotation as any).vertices
  if (vertices && vertices.length > 0) {
    vertices.pop()
    draft.isValid =
      draft.annotation.type === 'polygon' ? vertices.length >= 3 : vertices.length >= 2
  }
}

function handleCancelDraft() {
  annotationStore.clearDraft()
}

function handleDeleteSelected() {
  if (annotationStore.selectedId) {
    annotationStore.deleteAnnotation(annotationStore.selectedId)
  }
}

async function handleRollbackSelected() {
  const ann = annotationStore.selectedAnnotation
  if (!ann || ann.version <= 1) return
  try {
    await versionApi.rollback(ann.id, ann.version - 1)
  } catch (e) {
    console.error('rollback failed:', e)
  }
}

function getSelectedLabel(): string {
  const ann = annotationStore.selectedAnnotation
  if (!ann) return ''
  const cat = annotationStore.categories.find((c) => c.id === ann.categoryId)
  return cat?.name || ann.type
}
</script>

<style scoped>
.annotation-toolbar {
  width: 240px;
  height: 100%;
  background: #1a1d23;
  border-left: 1px solid #2d3139;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  user-select: none;
}
.toolbar-section {
  padding: 12px 14px;
  border-bottom: 1px solid #2d3139;
}
.section-title {
  color: #8b949e;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px 0;
}
.tool-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: #21262d;
  border: 1px solid #2d3139;
  color: #8b949e;
  cursor: pointer;
  border-radius: 6px;
  font-size: 12px;
  transition: all 0.15s;
}
.tool-btn:hover { color: #e0e0e0; border-color: #3d4149; }
.tool-btn.active { background: #1f3a5f; color: #58a6ff; border-color: #58a6ff; }
.tool-icon { font-size: 14px; }
.tool-label { font-size: 11px; }
.category-list { display: flex; flex-direction: column; gap: 4px; }
.category-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #21262d;
  border: 1px solid #2d3139;
  color: #8b949e;
  cursor: pointer;
  border-radius: 6px;
  font-size: 12px;
  text-align: left;
  transition: all 0.15s;
}
.category-btn:hover { color: #e0e0e0; }
.category-btn.active { border-color: #58a6ff; color: #e0e0e0; }
.category-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}
.category-name { font-size: 12px; }
.draft-actions { display: flex; flex-direction: column; gap: 4px; }
.action-btn {
  padding: 6px 12px;
  background: #21262d;
  border: 1px solid #2d3139;
  color: #8b949e;
  cursor: pointer;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  transition: all 0.15s;
}
.action-btn:hover:not(:disabled) { color: #e0e0e0; border-color: #3d4149; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn.danger:hover:not(:disabled) { color: #f85149; border-color: #f85149; }
.selected-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}
.info-label { color: #e0e0e0; font-size: 13px; }
.info-version { color: #8b949e; font-size: 11px; }
.annotation-actions { display: flex; gap: 4px; margin-top: 6px; }
.annotation-actions .action-btn { flex: 1; }
.collab-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}
.collab-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}
.collab-status.connected { color: #3fb950; background: rgba(63, 185, 80, 0.1); }
.collab-status.connecting, .collab-status.reconnecting { color: #d29922; background: rgba(210, 153, 34, 0.1); }
.collab-status.disconnected { color: #8b949e; }
.collab-status.error { color: #f85149; background: rgba(248, 81, 73, 0.1); }
.collab-users { color: #8b949e; font-size: 11px; }
.online-users { margin-top: 6px; }
.online-user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}
.user-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.user-name { color: #8b949e; font-size: 12px; }
</style>

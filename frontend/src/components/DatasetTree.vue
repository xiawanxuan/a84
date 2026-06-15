<template>
  <div class="dataset-tree">
    <div class="tree-header">
      <h3>机载勘测点云</h3>
      <button class="refresh-btn" @click="refreshTree" :disabled="store.loading">⟳</button>
    </div>
    <div class="tree-search">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索点云数据..."
        class="search-input"
      />
    </div>
    <div class="tree-content">
      <div
        v-for="node in filteredNodes"
        :key="node.id"
        class="tree-item"
        :class="{ active: node.id === store.activeDatasetId }"
        @click="handleSelect(node)"
      >
        <span class="tree-icon">{{ node.type === 'folder' ? '📁' : '🌲' }}</span>
        <div class="tree-item-info">
          <span class="tree-item-name">{{ node.name }}</span>
          <span v-if="node.metadata?.pointCount" class="tree-item-meta">
            {{ formatPointCount(node.metadata.pointCount) }} 点
          </span>
          <span v-if="node.metadata?.status" class="tree-item-status" :class="node.metadata.status">
            {{ statusLabel(node.metadata.status) }}
          </span>
        </div>
      </div>
      <div v-if="filteredNodes.length === 0" class="tree-empty">
        {{ store.loading ? '加载中...' : '暂无点云数据' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePointcloudStore } from '@/stores/pointcloud'
import type { DatasetNode } from '@/types/user'

const store = usePointcloudStore()
const searchQuery = ref('')

const filteredNodes = computed(() => {
  if (!searchQuery.value) return store.treeNodes
  const q = searchQuery.value.toLowerCase()
  return store.treeNodes.filter((n) => n.name.toLowerCase().includes(q))
})

function handleSelect(node: DatasetNode) {
  if (node.type === 'dataset') {
    store.loadDataset(node.id)
  }
}

function refreshTree() {
  store.fetchTree()
}

function formatPointCount(count: number): string {
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M'
  if (count >= 1_000) return (count / 1_000).toFixed(1) + 'K'
  return String(count)
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    'unannotated': '未标注',
    'in-progress': '标注中',
    'completed': '已完成',
    'reviewed': '已审核',
  }
  return map[status] || status
}

onMounted(() => {
  store.fetchTree()
})
</script>

<style scoped>
.dataset-tree {
  width: 260px;
  height: 100%;
  background: #1a1d23;
  border-right: 1px solid #2d3139;
  display: flex;
  flex-direction: column;
  user-select: none;
}
.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #2d3139;
}
.tree-header h3 {
  color: #e0e0e0;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.refresh-btn {
  background: none;
  border: 1px solid #3d4149;
  color: #8b949e;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
}
.refresh-btn:hover { color: #e0e0e0; border-color: #58a6ff; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tree-search { padding: 8px 12px; }
.search-input {
  width: 100%;
  background: #0d1117;
  border: 1px solid #2d3139;
  color: #e0e0e0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}
.search-input:focus { border-color: #58a6ff; }
.search-input::placeholder { color: #484f58; }
.tree-content { flex: 1; overflow-y: auto; padding: 4px 0; }
.tree-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.15s;
}
.tree-item:hover { background: #21262d; }
.tree-item.active { background: #1f3a5f; }
.tree-icon { font-size: 16px; margin-right: 8px; flex-shrink: 0; }
.tree-item-info { flex: 1; min-width: 0; }
.tree-item-name {
  display: block;
  color: #e0e0e0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-item-meta {
  font-size: 11px;
  color: #8b949e;
  margin-right: 6px;
}
.tree-item-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  color: #fff;
}
.tree-item-status.unannotated { background: #484f58; }
.tree-item-status.in-progress { background: #1f6feb; }
.tree-item-status.completed { background: #238636; }
.tree-item-status.reviewed { background: #8957e5; }
.tree-empty {
  text-align: center;
  color: #484f58;
  padding: 32px 16px;
  font-size: 13px;
}
</style>

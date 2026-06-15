import type { Annotation } from '@/types/annotation'

const DRAFT_STORAGE_KEY = 'forest-annotation-drafts'
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000

interface DraftEntry {
  annotation: Annotation
  savedAt: number
  expiresAt: number
}

interface DraftStorage {
  [datasetId: string]: {
    [annotationId: string]: DraftEntry
  }
}

export class LocalDraftCache {
  private storage: Storage
  private cache: DraftStorage

  constructor() {
    this.storage = window.localStorage
    this.cache = this.loadFromStorage()
  }

  saveDraft(datasetId: string, annotation: Annotation): void {
    const now = Date.now()
    const entry: DraftEntry = {
      annotation,
      savedAt: now,
      expiresAt: now + DRAFT_TTL
    }

    if (!this.cache[datasetId]) {
      this.cache[datasetId] = {}
    }
    this.cache[datasetId][annotation.id] = entry
    this.saveToStorage()
  }

  getDraft(datasetId: string, annotationId: string): Annotation | null {
    const datasetDrafts = this.cache[datasetId]
    if (!datasetDrafts) return null

    const entry = datasetDrafts[annotationId]
    if (!entry) return null

    if (this.isExpired(entry)) {
      this.removeDraft(datasetId, annotationId)
      return null
    }

    return entry.annotation
  }

  getDatasetDrafts(datasetId: string): Annotation[] {
    const datasetDrafts = this.cache[datasetId]
    if (!datasetDrafts) return []

    const annotations: Annotation[] = []
    for (const [annotationId, entry] of Object.entries(datasetDrafts)) {
      if (this.isExpired(entry)) {
        this.removeDraft(datasetId, annotationId)
      } else {
        annotations.push(entry.annotation)
      }
    }
    return annotations
  }

  removeDraft(datasetId: string, annotationId: string): void {
    if (this.cache[datasetId]) {
      delete this.cache[datasetId][annotationId]
      if (Object.keys(this.cache[datasetId]).length === 0) {
        delete this.cache[datasetId]
      }
      this.saveToStorage()
    }
  }

  removeDatasetDrafts(datasetId: string): void {
    delete this.cache[datasetId]
    this.saveToStorage()
  }

  clearAllDrafts(): void {
    this.cache = {}
    this.saveToStorage()
  }

  hasDraft(datasetId: string, annotationId: string): boolean {
    return this.getDraft(datasetId, annotationId) !== null
  }

  getDraftCount(datasetId?: string): number {
    if (datasetId) {
      return this.getDatasetDrafts(datasetId).length
    }
    let count = 0
    for (const datasetDrafts of Object.values(this.cache)) {
      count += Object.keys(datasetDrafts).length
    }
    return count
  }

  cleanupExpired(): void {
    for (const [datasetId, datasetDrafts] of Object.entries(this.cache)) {
      for (const [annotationId, entry] of Object.entries(datasetDrafts)) {
        if (this.isExpired(entry)) {
          delete this.cache[datasetId][annotationId]
        }
      }
      if (Object.keys(this.cache[datasetId]).length === 0) {
        delete this.cache[datasetId]
      }
    }
    this.saveToStorage()
  }

  private isExpired(entry: DraftEntry): boolean {
    return Date.now() > entry.expiresAt
  }

  private loadFromStorage(): DraftStorage {
    try {
      const raw = this.storage.getItem(DRAFT_STORAGE_KEY)
      if (raw) {
        return JSON.parse(raw) as DraftStorage
      }
    } catch (error) {
      console.error('Failed to load draft cache from localStorage:', error)
    }
    return {}
  }

  private saveToStorage(): void {
    try {
      this.storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(this.cache))
    } catch (error) {
      console.error('Failed to save draft cache to localStorage:', error)
    }
  }
}

let globalCache: LocalDraftCache | null = null

export function getLocalDraftCache(): LocalDraftCache {
  if (!globalCache) {
    globalCache = new LocalDraftCache()
    globalCache.cleanupExpired()
  }
  return globalCache
}

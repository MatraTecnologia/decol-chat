interface UserPresence {
  socketIds: Set<string>
  offlineTimer?: ReturnType<typeof setTimeout>
}

const store = new Map<string, UserPresence>()

export const presence = {
  add(userId: string, socketId: string): void {
    const entry = store.get(userId)

    if (entry) {
      if (entry.offlineTimer) {
        clearTimeout(entry.offlineTimer)
        entry.offlineTimer = undefined
      }
      entry.socketIds.add(socketId)
    } else {
      store.set(userId, { socketIds: new Set([socketId]) })
    }
  },

  remove(userId: string, socketId: string, onOffline: () => void): void {
    const entry = store.get(userId)
    if (!entry) return

    entry.socketIds.delete(socketId)

    if (entry.socketIds.size === 0) {
      entry.offlineTimer = setTimeout(() => {
        store.delete(userId)
        onOffline()
      }, 30_000)
    }
  },

  getOnlineUserIds(): string[] {
    return [...store.keys()]
  },

  isOnline(userId: string): boolean {
    return store.has(userId)
  },

  clear(): void {
    for (const entry of store.values()) {
      if (entry.offlineTimer) {
        clearTimeout(entry.offlineTimer)
      }
    }
    store.clear()
  },
}

'use client'

import { create } from 'zustand'

interface InboxPanelsStore {
  contactPanelOpen: boolean
  toggleContactPanel: () => void
  setContactPanelOpen: (open: boolean) => void
}

export const useInboxPanels = create<InboxPanelsStore>(set => ({
  contactPanelOpen: true,
  toggleContactPanel: () =>
    set(state => ({ contactPanelOpen: !state.contactPanelOpen })),
  setContactPanelOpen: open => set({ contactPanelOpen: open }),
}))

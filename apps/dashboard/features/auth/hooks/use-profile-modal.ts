import { create } from 'zustand'

interface ProfileModalState {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onOpenChange: (open: boolean) => void
}

export const useProfileModal = create<ProfileModalState>(set => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  onOpenChange: (open: boolean) => set({ isOpen: open }),
}))

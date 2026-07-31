'use client'

import { create } from 'zustand'

interface MessageDraftsStore {
  drafts: Record<string, string>
  getDraft: (conversationId: string) => string
  setDraft: (conversationId: string, text: string) => void
  clearDraft: (conversationId: string) => void
}

/**
 * O atendente alterna entre conversas o tempo todo — o que ele digitou e não
 * enviou precisa continuar lá quando ele voltar.
 */
export const useMessageDrafts = create<MessageDraftsStore>((set, get) => ({
  drafts: {},
  getDraft: conversationId => get().drafts[conversationId] ?? '',
  setDraft: (conversationId, text) =>
    set(state => ({ drafts: { ...state.drafts, [conversationId]: text } })),
  clearDraft: conversationId =>
    set(state => {
      if (!(conversationId in state.drafts)) return state

      const drafts = { ...state.drafts }
      delete drafts[conversationId]

      return { drafts }
    }),
}))

import { openai } from '@ai-sdk/openai'

type ModelMeta = {
  label: string
  /** USD por 1M tokens de entrada */
  input: number
  /** USD por 1M tokens de saída */
  output: number
  /** Tamanho da janela de contexto em tokens */
  context: number
  /** Modelo com raciocínio estendido (chain-of-thought) */
  reasoning: boolean
  /** Velocidade relativa de resposta */
  speed: 'slow' | 'medium' | 'fast'
}

export const modelMeta = {
  // ── GPT-4o ──────────────────────────────────────────────────
  'gpt-4o': {
    label: 'GPT-4o',
    input: 2.5,
    output: 10.0,
    context: 128_000,
    reasoning: false,
    speed: 'fast',
  },
  'gpt-4o-mini': {
    label: 'GPT-4o Mini',
    input: 0.15,
    output: 0.6,
    context: 128_000,
    reasoning: false,
    speed: 'fast',
  },
  // ── GPT-4.1 ─────────────────────────────────────────────────
  'gpt-4.1': {
    label: 'GPT-4.1',
    input: 2.0,
    output: 8.0,
    context: 1_000_000,
    reasoning: false,
    speed: 'fast',
  },
  'gpt-4.1-mini': {
    label: 'GPT-4.1 Mini',
    input: 0.2,
    output: 0.8,
    context: 1_000_000,
    reasoning: false,
    speed: 'fast',
  },
  'gpt-4.1-nano': {
    label: 'GPT-4.1 Nano',
    input: 0.1,
    output: 0.4,
    context: 1_000_000,
    reasoning: false,
    speed: 'fast',
  },
  // ── GPT-5 ───────────────────────────────────────────────────
  'gpt-5': {
    label: 'GPT-5',
    input: 1.25,
    output: 10.0,
    context: 400_000,
    reasoning: false,
    speed: 'medium',
  },
  'gpt-5-mini': {
    label: 'GPT-5 Mini',
    input: 0.25,
    output: 2.0,
    context: 400_000,
    reasoning: false,
    speed: 'fast',
  },
  'gpt-5-nano': {
    label: 'GPT-5 Nano',
    input: 0.05,
    output: 0.4,
    context: 400_000,
    reasoning: false,
    speed: 'fast',
  },
  'gpt-5-pro': {
    label: 'GPT-5 Pro',
    input: 15.0,
    output: 120.0,
    context: 400_000,
    reasoning: false,
    speed: 'slow',
  },
  // ── Reasoning ───────────────────────────────────────────────
  'o3-mini': {
    label: 'o3 Mini',
    input: 0.55,
    output: 2.2,
    context: 200_000,
    reasoning: true,
    speed: 'slow',
  },
  'o4-mini': {
    label: 'o4 Mini',
    input: 0.55,
    output: 2.2,
    context: 200_000,
    reasoning: true,
    speed: 'slow',
  },
} satisfies Record<string, ModelMeta>

export const models = {
  // ── GPT-4o ──────────────────────────────────────────────────
  'gpt-4o': openai('gpt-4o'),
  'gpt-4o-mini': openai('gpt-4o-mini'),
  // ── GPT-4.1 ─────────────────────────────────────────────────
  'gpt-4.1': openai('gpt-4.1'),
  'gpt-4.1-mini': openai('gpt-4.1-mini'),
  'gpt-4.1-nano': openai('gpt-4.1-nano'),
  // ── GPT-5 ───────────────────────────────────────────────────
  'gpt-5': openai('gpt-5'),
  'gpt-5-mini': openai('gpt-5-mini'),
  'gpt-5-nano': openai('gpt-5-nano'),
  'gpt-5-pro': openai('gpt-5-pro'),
  // ── Reasoning ───────────────────────────────────────────────
  'o3-mini': openai('o3-mini'),
  'o4-mini': openai('o4-mini'),
} as const

export type ModelId = keyof typeof models

export const defaultModel = models['gpt-4o-mini']

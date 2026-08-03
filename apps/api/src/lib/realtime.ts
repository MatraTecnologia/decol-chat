/**
 * Ponte para quem muda estado sem ter a instância do Fastify em mãos — hoje só
 * os `databaseHooks` do Better Auth.
 *
 * O emissor registrado é o mesmo closure decorado em `plugins/socket.ts`, então
 * a rota de emissão (e o preenchimento das tags) continua sendo uma só.
 */
import type { RealtimeEvent } from './realtime-events.js'

type RealtimeEmitter = (event: RealtimeEvent) => void

let emitter: RealtimeEmitter | null = null

export const setRealtimeEmitter = (next: RealtimeEmitter) => {
  emitter = next
}

/** Sem socket registrado (boot, testes, scripts) o evento é descartado. */
export const emitRealtime = (event: RealtimeEvent) => {
  emitter?.(event)
}

import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq'

import { env } from '@/env.js'

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
}

const prefix = `v7:${env.NODE_ENV}`

/** Registry of all queues — used by Bull Board to auto-discover them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queueRegistry: Queue<any>[] = []

export function getRegisteredQueues() {
  return queueRegistry
}

/**
 * Creates a BullMQ Queue and registers it for monitoring.
 *
 * @example
 * ```ts
 * const emailQueue = createQueue('email')
 * await emailQueue.add('welcome', { to: 'user@example.com' })
 * ```
 */
export function createQueue<T = unknown>(name: string) {
  const queue = new Queue<T>(name, {
    connection: { url: env.REDIS_URL },
    prefix,
    defaultJobOptions,
  })

  queueRegistry.push(queue)
  return queue
}

/**
 * Creates a BullMQ Worker.
 *
 * @example
 * ```ts
 * const emailWorker = createWorker('email', async job => {
 *   await sendEmail(job.data)
 * })
 * ```
 */
export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  concurrency = 5,
) {
  return new Worker<T>(name, processor, {
    connection: { url: env.REDIS_URL },
    prefix,
    concurrency,
  })
}

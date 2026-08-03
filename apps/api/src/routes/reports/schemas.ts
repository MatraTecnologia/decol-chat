import { z } from 'zod'

import { REPORT_STATUSES } from './reports-shaping.js'

export const overviewQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  assigneeId: z.string().optional(),
})

export const rangeQuerySchema = overviewQuerySchema.omit({ assigneeId: true })

export const overviewResponseSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  totals: z.object({
    conversationsStarted: z.number(),
    conversationsOpen: z.number(),
    conversationsPending: z.number(),
    conversationsClosed: z.number(),
    messagesInbound: z.number(),
    messagesOutbound: z.number(),
    templatesSent: z.number(),
    unassigned: z.number(),
    outsideWindow: z.number(),
    failedMessages: z.number(),
  }),
  averages: z.object({
    firstResponseSeconds: z.number().nullable(),
    resolutionSeconds: z.number().nullable(),
    replySeconds: z.number().nullable(),
  }),
  series: z.array(
    z.object({
      date: z.string(),
      inbound: z.number(),
      outbound: z.number(),
      started: z.number(),
      closed: z.number(),
    }),
  ),
  heatmap: z.array(
    z.object({
      weekday: z.number(),
      hour: z.number(),
      count: z.number(),
    }),
  ),
  statusBreakdown: z.array(
    z.object({
      status: z.enum(REPORT_STATUSES),
      count: z.number(),
    }),
  ),
})

export const agentPerformanceResponseSchema = z.object({
  data: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      email: z.string(),
      image: z.string().nullable(),
      role: z.string(),
      assigned: z.number(),
      closed: z.number(),
      open: z.number(),
      messagesSent: z.number(),
      firstResponseSeconds: z.number().nullable(),
      resolutionSeconds: z.number().nullable(),
      lastActivityAt: z.string().nullable(),
    }),
  ),
})

export type OverviewReport = z.infer<typeof overviewResponseSchema>
export type AgentPerformanceReport = z.infer<
  typeof agentPerformanceResponseSchema
>

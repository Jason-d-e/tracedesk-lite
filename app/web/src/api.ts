import type { AnswerResult, ApiError, AskPayload, DocInfo, Insights, Quality, ReviewItem, StatusInfo } from './types'

export class RequestError extends Error {
  info: ApiError
  constructor(info: ApiError) {
    super(info.message)
    this.info = info
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new RequestError({ code: 'network', message: 'network', retryable: true })
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* not JSON */
  }
  const err = (body as { error?: ApiError } | null)?.error
  if (!res.ok || err) {
    throw new RequestError(err ?? { code: 'generic', message: `HTTP ${res.status}`, retryable: true })
  }
  return body as T
}

const json = (data: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})

export const api = {
  status: () => call<StatusInfo>('/api/status'),
  sources: () => call<{ knowledge_version: string; provenance: string; documents: DocInfo[] }>('/api/sources'),
  ask: (payload: AskPayload) => call<AnswerResult>('/api/ask', json(payload)),
  report: (data: Record<string, unknown>) => call<{ id: string }>('/api/reviews', json(data)),
  reviews: (status: string) =>
    call<{ counts: { pending: number; reviewed: number }; reviews: ReviewItem[] }>(`/api/reviews${status ? `?status=${status}` : ''}`),
  updateReview: (id: string, review_status: 'pending' | 'reviewed', reviewer_note: string) =>
    call<ReviewItem>(`/api/reviews/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status, reviewer_note }),
    }),
  insights: () => call<Insights>('/api/insights'),
  quality: () => call<Quality>('/api/quality'),
}

export type Status = 'answered' | 'insufficient_evidence' | 'needs_clarification' | 'withheld'

export interface Citation {
  source_id: string
  quote: string
  verified: boolean
  reason?: string | null
  title?: string
  version?: string
  effective_date?: string
  source_text?: string
  span?: { start: number; end: number } | null
}

export interface Step extends Citation {
  action: string
  deadline: string
  deadline_supported: boolean | null
}

export interface AnswerResult {
  status: Status
  model_status: string
  key_point: string
  answer: string
  next_steps: Step[]
  missing_info: string
  clarifying_question: string
  citations: Citation[]
  checks: { citations_total: number; citations_verified: number; steps_total: number; steps_verified: number; withheld: boolean }
  meta: { prompt_version: string; knowledge_version: string; model_served: string; model_requested: string; latency_ms: number; fallback_used?: boolean }
}

export interface AskPayload {
  question: string
  context?: { previous_question: string; clarifying_question: string }
}

export interface ApiError {
  code?: string
  message: string
  retryable?: boolean
}

export interface StatusInfo {
  model_configured: boolean
  model: string
  knowledge_version: string
  prompt_version: string
  active_chunks: number
}

export interface DocSection { id: string; text: string }
export interface DocInfo {
  id: string
  title: string
  version: string
  status: string
  effective_date: string
  superseded_by: string | null
  sections: DocSection[]
}

export type ReviewReason =
  | 'wrong_fact' | 'wrong_source' | 'missing_information' | 'should_have_answered'
  | 'should_have_asked' | 'hard_to_follow' | 'other'

export interface ReviewItem {
  id: string
  created_at: string
  question: string
  answer_status: Status | ''
  key_point: string
  related_sources: string[]
  review_reason: ReviewReason
  user_note: string
  review_status: 'pending' | 'reviewed'
  reviewer_note: string
  reviewed_at: string
  prompt_version: string
  knowledge_version: string
  model: string
}

export interface Gap {
  question: string
  asked: number
  reported: number
  last_seen: string
  missing_info: string
  reader_notes: string[]
}

export interface Insights {
  questions_answered_by_app: number
  by_status: Partial<Record<Status, number>>
  unanswered_share: number
  top_gaps: Gap[]
}

export interface Quality {
  held_out_questions: number
  prompt_version: string
  runs: { prompt: string; plain: number; ours: number; n: number }[]
  metrics: Record<string, { plain: number; ours: number; n: number }>
  cost_per_question_usd: { plain: number; ours: number }
  median_latency_s: { plain: number; ours: number }
  run_date: string
}

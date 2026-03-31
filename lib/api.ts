const API_BASE = 'https://api.virtuallaunch.pro';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { /* ignore */ }
    throw new ApiError(res.status, `HTTP ${res.status}`, body);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export async function getSession(): Promise<Session | null> {
  try {
    return await request<Session>('/v1/auth/session');
  } catch {
    return null;
  }
}

// ── Developers ────────────────────────────────────────────────────────────────

export interface Developer {
  ref_number: string;
  full_name: string;
  status: string;
  publish_profile: boolean;
  plan?: 'free' | 'paid';
  skills?: Record<string, number>;
  hourly_rate?: number;
  availability?: string;
  bio?: string;
  location?: string;
  [key: string]: unknown;
}

export async function getDevelopers(params?: Record<string, string>): Promise<{ ok: boolean; results: Developer[] }> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/v1/dvlp/developers${qs}`);
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export interface OnboardingRecord {
  eventId: string;
  ref_number?: string;
  full_name?: string;
  email?: string;
  status?: string;
  [key: string]: unknown;
}

export async function getOnboarding(ref: string): Promise<{ ok: boolean; record: OnboardingRecord }> {
  return request(`/v1/dvlp/onboarding?ref=${encodeURIComponent(ref)}`);
}

export async function getOnboardingStatus(ref: string): Promise<{ ok: boolean; status: string; lastUpdated: string }> {
  return request(`/v1/dvlp/onboarding/status?ref=${encodeURIComponent(ref)}`);
}

export async function submitOnboarding(data: Record<string, unknown>): Promise<{ ok: boolean; eventId: string; ref_number: string }> {
  return request('/v1/dvlp/onboarding', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateOnboarding(data: Record<string, unknown>): Promise<{ ok: boolean }> {
  return request('/v1/dvlp/onboarding', { method: 'PATCH', body: JSON.stringify(data) });
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export interface Job {
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

export async function getJobs(): Promise<{ ok: boolean; results: Job[] }> {
  return request('/v1/dvlp/jobs');
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface Review {
  eventId: string;
  author_name: string;
  author_email?: string;
  author_role?: string;
  rating: number;
  review_text: string;
  createdAt?: string;
}

export async function getReviews(): Promise<{ ok: boolean; reviews: Review[] }> {
  return request('/v1/dvlp/reviews');
}

export async function submitReview(data: Omit<Review, 'createdAt'>): Promise<{ ok: boolean }> {
  return request('/v1/dvlp/reviews', { method: 'POST', body: JSON.stringify(data) });
}

// ── Developer match intake ────────────────────────────────────────────────────

export async function submitMatchIntake(data: Record<string, unknown>): Promise<{ ok: boolean }> {
  return request('/v1/dvlp/developer-match-intake', { method: 'POST', body: JSON.stringify(data) });
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export interface PricingPlan {
  id: 'free' | 'paid';
  name: string;
  price: number;
  interval?: string;
  features: string[];
  cta: string;
}

export interface DvlpPricing {
  free: PricingPlan;
  paid: PricingPlan;
}

export async function getDvlpPricing(): Promise<{ ok: boolean; plans: DvlpPricing }> {
  return request('/v1/dvlp/pricing');
}

export async function getDeveloperPlan(ref: string): Promise<{ ok: boolean; plan: string | null }> {
  try {
    const data = await request<{ ok: boolean; record: OnboardingRecord }>(`/v1/dvlp/onboarding?ref=${encodeURIComponent(ref)}`);
    return { ok: data.ok, plan: (data.record?.plan as string) ?? null };
  } catch {
    return { ok: false, plan: null };
  }
}

// ── Stripe ────────────────────────────────────────────────────────────────────

export async function createCheckout(data: { plan: 'free' | 'paid'; eventId: string; email?: string; internal?: boolean }): Promise<{ ok: boolean; url: string }> {
  return request('/v1/dvlp/stripe/checkout', { method: 'POST', body: JSON.stringify(data) });
}

export async function getSessionStatus(session_id: string): Promise<{ ok: boolean; status: string; plan?: string; vlp_ref?: string }> {
  return request(`/v1/dvlp/stripe/session-status?session_id=${encodeURIComponent(session_id)}`);
}

// ── Operator — Analytics ──────────────────────────────────────────────────────

export interface AnalyticsData {
  submissions: number;
  active: number;
  pending: number;
  published: number;
  timeSeries?: unknown[];
  pageViews?: unknown;
}

export async function getAnalytics(): Promise<{ ok: boolean; data: AnalyticsData }> {
  return request('/v1/dvlp/operator/analytics', { method: 'POST' });
}

// ── Operator — Submissions ────────────────────────────────────────────────────

export async function getSubmissions(params?: Record<string, string>): Promise<{ ok: boolean; results: OnboardingRecord[]; total: number }> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/v1/dvlp/operator/submissions${qs}`);
}

// ── Operator — Developer ──────────────────────────────────────────────────────

export async function getDeveloper(ref: string): Promise<{ ok: boolean; record: Developer }> {
  return request(`/v1/dvlp/operator/developer?ref=${encodeURIComponent(ref)}`);
}

export async function updateDeveloper(data: { ref_number: string; [key: string]: unknown }): Promise<{ ok: boolean; ref_number: string; updatedAt: string }> {
  return request('/v1/dvlp/operator/developer', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getOperatorDevelopers(params?: Record<string, string>): Promise<{ ok: boolean; results: Pick<Developer, 'ref_number' | 'full_name' | 'status' | 'publish_profile' | 'plan'>[] }> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/v1/dvlp/operator/developers${qs}`);
}

// ── Operator — Jobs ───────────────────────────────────────────────────────────

export async function getOperatorJobs(status?: string): Promise<{ ok: boolean; results: Job[] }> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/v1/dvlp/operator/jobs${qs}`);
}

export async function createJob(data: Record<string, unknown>): Promise<{ ok: boolean; jobId: string }> {
  return request('/v1/dvlp/operator/jobs', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateJob(job_id: string, data: Record<string, unknown>): Promise<{ ok: boolean }> {
  return request(`/v1/dvlp/operator/jobs/${encodeURIComponent(job_id)}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// ── Operator — Post ───────────────────────────────────────────────────────────

export async function postToDeveloper(data: { eventId: string; ref_number: string; jobTitle: string; jobDescription: string; jobId?: string }): Promise<{ ok: boolean }> {
  return request('/v1/dvlp/operator/post', { method: 'POST', body: JSON.stringify(data) });
}

// ── Operator — Messages ───────────────────────────────────────────────────────

export interface Message {
  eventId: string;
  ref_number: string;
  subject: string;
  body: string;
  sentAt: string;
}

export async function sendMessage(data: { eventId: string; ref_number: string; subject: string; body: string }): Promise<{ ok: boolean }> {
  return request('/v1/dvlp/operator/messages', { method: 'POST', body: JSON.stringify(data) });
}

export async function getMessages(ref: string): Promise<{ ok: boolean; ref_number: string; messages: Message[] }> {
  return request(`/v1/dvlp/operator/messages?ref=${encodeURIComponent(ref)}`);
}

// ── Operator — Tickets ────────────────────────────────────────────────────────

export interface Ticket {
  ticketId: string;
  clientRef: string;
  subject: string;
  status: string;
  submittedAt: string;
  replyCount: number;
}

export async function getTickets(params?: Record<string, string>): Promise<{ ok: boolean; results: Ticket[] }> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/v1/dvlp/operator/tickets${qs}`);
}

export async function replyToTicket(ticket_id: string, data: { eventId: string; body: string; templateId?: string }): Promise<{ ok: boolean; ticketId: string; repliedAt: string }> {
  return request(`/v1/dvlp/operator/tickets/${encodeURIComponent(ticket_id)}/reply`, { method: 'POST', body: JSON.stringify(data) });
}

// ── Operator — Canned Responses ───────────────────────────────────────────────

export interface CannedResponse {
  templateId: string;
  label: string;
  subject: string;
  body: string;
  userType: string;
  isDefault: boolean;
}

export async function getCannedResponses(user_type?: string): Promise<{ ok: boolean; templates: CannedResponse[] }> {
  const qs = user_type ? `?userType=${encodeURIComponent(user_type)}` : '';
  return request(`/v1/dvlp/operator/canned-responses${qs}`);
}

export async function createCannedResponse(data: { eventId: string; userType: string; label: string; subject: string; body: string }): Promise<{ ok: boolean; templateId: string }> {
  return request('/v1/dvlp/operator/canned-responses', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCannedResponse(id: string, data: Record<string, unknown>): Promise<{ ok: boolean }> {
  return request(`/v1/dvlp/operator/canned-responses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteCannedResponse(id: string): Promise<{ ok: boolean }> {
  return request(`/v1/dvlp/operator/canned-responses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── Affiliates ────────────────────────────────────────────────────────────────

export interface AffiliateData {
  referral_code: string;
  connect_status: 'pending' | 'active' | 'restricted' | string;
  balance_pending: number;
  balance_paid: number;
  referral_url: string;
}

export interface AffiliateEvent {
  platform: string;
  gross_amount: number;
  commission_amount: number;
  status: 'pending' | 'paid' | string;
  created_at: string;
}

export interface PayoutResult {
  payout_id: string;
  amount: number;
  status: string;
}

export async function getAffiliate(account_id: string): Promise<AffiliateData> {
  return request(`/v1/affiliates/${encodeURIComponent(account_id)}`);
}

export async function getAffiliateEvents(account_id: string): Promise<AffiliateEvent[]> {
  return request(`/v1/affiliates/${encodeURIComponent(account_id)}/events`);
}

export async function startAffiliateOnboarding(): Promise<{ onboard_url: string }> {
  return request('/v1/affiliates/connect/onboard', { method: 'POST' });
}

export async function requestPayout(amount: number): Promise<PayoutResult> {
  return request('/v1/affiliates/payout/request', { method: 'POST', body: JSON.stringify({ amount }) });
}

// ── Operator — Bulk Email ──────────────────────────────────────────────────────

export async function sendBulkEmail(data: { eventId: string; subject: string; body?: string; templateId?: string; dryRun?: boolean; filters?: Record<string, unknown> }): Promise<{ ok: boolean; recipientCount?: number; sent?: number; failed?: number }> {
  return request('/v1/dvlp/operator/bulk-email', { method: 'POST', body: JSON.stringify(data) });
}

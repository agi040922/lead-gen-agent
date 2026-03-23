// Resend Webhook Edge Function
// Receives email events from Resend and updates email_logs + email_events tables
//
// Deploy: supabase functions deploy resend-webhook --project-ref rhthijurrjdklrzpqkcg
// Required env vars (set in Supabase Dashboard > Edge Functions > Secrets):
//   RESEND_WEBHOOK_SECRET - from Resend Dashboard > Webhooks > Signing Secret

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'

interface ResendClickData {
  ipAddress: string
  link: string
  timestamp: string
  userAgent: string
}

interface ResendBounceData {
  message: string
  subType: string
  type: string
}

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    click?: ResendClickData
    bounce?: ResendBounceData
  }
}

// TODO: Production용 서명 검증
// svix 라이브러리가 Deno에서 완전히 지원되지 않으므로 HMAC-SHA256으로 직접 구현 필요
// 참고: https://docs.svix.com/receiving/verifying-payloads/how-manual
async function verifySignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  try {
    // svix 서명 형식: "v1,<base64-hmac>"
    // 서명 대상 메시지: "{svix-id}.{svix-timestamp}.{payload}"
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`

    // "whsec_" 접두사 제거 후 base64 디코딩
    const secretBytes = secret.startsWith('whsec_')
      ? Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(secret)

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signedContent),
    )

    const computedSignature =
      'v1,' + btoa(String.fromCharCode(...new Uint8Array(signature)))

    // svix-signature 헤더는 "v1,<sig1> v1,<sig2>" 형식으로 여러 개일 수 있음
    const signatures = svixSignature.split(' ')
    return signatures.some((sig) => sig === computedSignature)
  } catch (err) {
    console.error('Signature verification error:', err)
    return false
  }
}

// email.delivered → delivered 처럼 "email." 접두사 제거
function stripEmailPrefix(eventType: ResendEventType): string {
  return eventType.replace(/^email\./, '')
}

// 이벤트 타입에 따라 email_logs의 어떤 타임스탬프 컬럼을 업데이트할지 결정
function getTimestampColumn(
  eventType: ResendEventType,
): string | null {
  const columnMap: Partial<Record<ResendEventType, string>> = {
    'email.delivered': 'delivered_at',
    'email.opened': 'opened_at',
    'email.clicked': 'clicked_at',
    'email.bounced': 'bounced_at',
    'email.complained': 'complained_at',
  }
  return columnMap[eventType] ?? null
}

Deno.serve(async (req) => {
  // POST 외 메서드 거부
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: string
  try {
    payload = await req.text()
  } catch {
    return new Response('Failed to read request body', { status: 400 })
  }

  // 서명 검증
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (WEBHOOK_SECRET) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('Missing svix headers — rejecting request')
      return new Response('Missing webhook signature headers', { status: 401 })
    }

    const isValid = await verifySignature(
      payload,
      svixId,
      svixTimestamp,
      svixSignature,
      WEBHOOK_SECRET,
    )

    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 401 })
    }
  } else {
    // RESEND_WEBHOOK_SECRET가 설정되지 않으면 경고만 출력하고 계속 진행
    console.warn(
      'RESEND_WEBHOOK_SECRET not set — skipping signature verification (not safe for production)',
    )
  }

  let event: ResendWebhookPayload
  try {
    event = JSON.parse(payload)
  } catch {
    return new Response('Invalid JSON payload', { status: 400 })
  }

  const { type: eventType, data } = event
  const resendEmailId = data?.email_id

  if (!resendEmailId) {
    console.error('No email_id in webhook payload')
    return new Response('Missing email_id', { status: 400 })
  }

  console.log(`Processing webhook: type=${eventType}, email_id=${resendEmailId}`)

  try {
    // 1. resend_email_id로 email_log 조회
    const { data: emailLog, error: logError } = await supabase
      .from('email_logs')
      .select('id, lead_id')
      .eq('resend_email_id', resendEmailId)
      .single()

    if (logError || !emailLog) {
      // 아직 DB에 없을 수 있음 (발송 직후 webhook이 더 빠른 경우)
      // email_events에만 기록하고 나중에 처리할 수 있도록 orphan 레코드로 저장
      console.warn(
        `No email_log found for resend_email_id=${resendEmailId}. Storing orphan event.`,
      )

      await supabase.from('email_events').insert({
        email_log_id: null,
        resend_email_id: resendEmailId,
        event_type: stripEmailPrefix(eventType),
        metadata: buildMetadata(event),
      })

      return new Response(JSON.stringify({ ok: true, status: 'orphan_stored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const emailLogId = emailLog.id
    const leadId = emailLog.lead_id

    // 2. email_events 테이블에 이벤트 기록
    const { error: eventError } = await supabase.from('email_events').insert({
      email_log_id: emailLogId,
      resend_email_id: resendEmailId,
      event_type: stripEmailPrefix(eventType),
      metadata: buildMetadata(event),
    })

    if (eventError) {
      console.error('Failed to insert email_event:', eventError)
      // 이벤트 기록 실패는 치명적이지 않으므로 계속 진행
    }

    // 3. email_logs 타임스탬프 업데이트 (이미 값이 있으면 덮어쓰지 않음)
    const timestampColumn = getTimestampColumn(eventType)
    if (timestampColumn) {
      const { error: updateError } = await supabase
        .from('email_logs')
        .update({ [timestampColumn]: new Date().toISOString() })
        .eq('id', emailLogId)
        .is(timestampColumn, null) // null인 경우에만 업데이트 (첫 이벤트만 기록)

      if (updateError) {
        console.error(`Failed to update ${timestampColumn}:`, updateError)
      }
    }

    // 4. bounced / complained 이벤트 → 리드 상태 업데이트 + 경고 메모 추가
    if (
      (eventType === 'email.bounced' || eventType === 'email.complained') &&
      leadId
    ) {
      await handleDeliveryFailure(leadId, eventType, data.bounce)
    }

    console.log(
      `Webhook processed: email_log_id=${emailLogId}, type=${eventType}`,
    )

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected error processing webhook:', error)
    return new Response('Internal server error', { status: 500 })
  }
})

// click / bounce 데이터를 metadata 객체로 변환
function buildMetadata(event: ResendWebhookPayload): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    created_at: event.created_at,
    from: event.data.from,
    to: event.data.to,
    subject: event.data.subject,
  }

  if (event.data.click) {
    meta.click = event.data.click
  }

  if (event.data.bounce) {
    meta.bounce = event.data.bounce
  }

  return meta
}

// bounced / complained 처리: 리드 상태를 유지하되 경고 메모 추가
// (영업 담당자가 직접 판단할 수 있도록 상태를 강제 변경하지 않음)
async function handleDeliveryFailure(
  leadId: string,
  eventType: 'email.bounced' | 'email.complained',
  bounceData?: ResendBounceData,
): Promise<void> {
  const eventLabel = eventType === 'email.bounced' ? '이메일 반송' : '스팸 신고'
  const bounceDetail = bounceData
    ? ` (${bounceData.type}: ${bounceData.message})`
    : ''
  const warningNote = `[경고] ${eventLabel} 발생${bounceDetail} — ${new Date().toISOString()}`

  // 기존 notes에 경고 메모를 append
  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('notes')
    .eq('id', leadId)
    .single()

  if (fetchError) {
    console.error('Failed to fetch lead for note update:', fetchError)
    return
  }

  const existingNotes = lead?.notes ?? ''
  const updatedNotes = existingNotes
    ? `${existingNotes}\n${warningNote}`
    : warningNote

  const { error: updateError } = await supabase
    .from('leads')
    .update({ notes: updatedNotes })
    .eq('id', leadId)

  if (updateError) {
    console.error('Failed to update lead notes:', updateError)
  } else {
    console.log(`Lead ${leadId} notes updated with ${eventLabel} warning`)
  }
}

import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendWithResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY가 설정되지 않았습니다.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Lead Gen <noreply@email.solhun.com>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API 오류: ${res.status} ${body}`);
  }

  return res.json();
}

async function main() {
  const [leadId] = process.argv.slice(2);

  if (!leadId) {
    console.error(JSON.stringify({ error: '사용법: npx tsx scripts/send-email.ts <lead-id>' }));
    process.exit(1);
  }

  // 해당 리드의 pending 이메일 조회
  const { data: emailLog, error: logError } = await supabase
    .from('email_logs')
    .select('*, leads!inner(email, company_name)')
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (logError || !emailLog) {
    console.error(JSON.stringify({ error: `발송할 이메일 없음: ${logError?.message || 'pending 이메일이 없습니다'}` }));
    process.exit(1);
  }

  const leadEmail = (emailLog as any).leads?.email;

  if (!leadEmail) {
    // 이메일 주소 없으면 실패 처리
    await supabase
      .from('email_logs')
      .update({ status: 'failed' })
      .eq('id', emailLog.id);

    console.error(JSON.stringify({ error: '리드에 이메일 주소가 없습니다.' }));
    process.exit(1);
  }

  try {
    const resendResult = await sendWithResend(leadEmail, emailLog.subject, emailLog.body_html);

    await supabase
      .from('email_logs')
      .update({ status: 'sent', sent_at: new Date().toISOString(), resend_email_id: resendResult.id })
      .eq('id', emailLog.id);

    // 리드 상태를 contacted로 변경
    await supabase
      .from('leads')
      .update({ status: 'contacted' })
      .eq('id', leadId);

    console.log(JSON.stringify({
      success: true,
      email_log_id: emailLog.id,
      sent_to: leadEmail,
      subject: emailLog.subject,
    }));
  } catch (err: any) {
    await supabase
      .from('email_logs')
      .update({ status: 'failed' })
      .eq('id', emailLog.id);

    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();

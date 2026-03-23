import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

function replaceVariables(template: string, lead: any): string {
  return template
    .replace(/\{\{company_name\}\}/g, lead.company_name || '')
    .replace(/\{\{region\}\}/g, lead.region || '')
    .replace(/\{\{category\}\}/g, lead.category || '')
    .replace(/\{\{phone\}\}/g, lead.phone || '')
    .replace(/\{\{email\}\}/g, lead.email || '');
}

async function draftForLead(leadId: string) {
  // 리드 조회
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(`리드 조회 실패: ${leadError?.message || 'not found'}`);
  }

  // 업종에 맞는 템플릿 찾기 (없으면 일반 템플릿)
  let { data: template } = await supabase
    .from('email_templates')
    .select('*')
    .ilike('target_category', `%${lead.category || ''}%`)
    .limit(1)
    .single();

  if (!template) {
    const { data: fallback } = await supabase
      .from('email_templates')
      .select('*')
      .eq('target_category', '일반')
      .limit(1)
      .single();
    template = fallback;
  }

  if (!template) {
    throw new Error('사용 가능한 이메일 템플릿이 없습니다.');
  }

  const subject = replaceVariables(template.subject, lead);
  const bodyHtml = replaceVariables(template.body_html, lead);

  // email_logs에 pending으로 INSERT
  const { data: emailLog, error: insertError } = await supabase
    .from('email_logs')
    .insert({
      lead_id: lead.id,
      template_id: template.id,
      subject,
      body_html: bodyHtml,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`이메일 초안 저장 실패: ${insertError.message}`);
  }

  return { lead_id: lead.id, company_name: lead.company_name, email_log_id: emailLog.id, subject };
}

async function main() {
  const [leadId] = process.argv.slice(2);

  if (leadId) {
    try {
      const result = await draftForLead(leadId);
      console.log(JSON.stringify({ success: true, drafted: 1, results: [result] }));
    } catch (err: any) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
    return;
  }

  // lead_id 없으면 filtered 상태인 리드 전체에 대해 draft
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id')
    .eq('status', 'filtered');

  if (error) {
    console.error(JSON.stringify({ error: `리드 조회 실패: ${error.message}` }));
    process.exit(1);
  }

  const results = [];
  let errors = 0;

  for (const lead of leads || []) {
    try {
      const result = await draftForLead(lead.id);
      results.push(result);
    } catch {
      errors++;
    }
  }

  console.log(JSON.stringify({
    success: true,
    drafted: results.length,
    errors,
    results,
  }));
}

main();

import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

// draft-email의 로직 재사용
function replaceVariables(template: string, lead: any): string {
  return template
    .replace(/\{\{company_name\}\}/g, lead.company_name || '')
    .replace(/\{\{region\}\}/g, lead.region || '')
    .replace(/\{\{category\}\}/g, lead.category || '')
    .replace(/\{\{phone\}\}/g, lead.phone || '')
    .replace(/\{\{email\}\}/g, lead.email || '');
}

async function main() {
  const [statusFilter, limitStr] = process.argv.slice(2);
  const targetStatus = statusFilter || 'filtered';
  const limit = parseInt(limitStr) || 50;

  // 대상 리드 조회
  const { data: leads, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('status', targetStatus)
    .limit(limit);

  if (leadError) {
    console.error(JSON.stringify({ error: `리드 조회 실패: ${leadError.message}` }));
    process.exit(1);
  }

  if (!leads || leads.length === 0) {
    console.log(JSON.stringify({ success: true, drafted: 0, message: `${targetStatus} 상태의 리드가 없습니다.` }));
    return;
  }

  // 템플릿 전체 로드
  const { data: templates } = await supabase.from('email_templates').select('*');

  if (!templates || templates.length === 0) {
    console.error(JSON.stringify({ error: '이메일 템플릿이 없습니다.' }));
    process.exit(1);
  }

  let drafted = 0;
  let errors = 0;

  for (const lead of leads) {
    // 업종 매칭 템플릿 찾기
    let template = templates.find((t) =>
      t.target_category && lead.category &&
      lead.category.includes(t.target_category)
    );

    // 없으면 일반 템플릿
    if (!template) {
      template = templates.find((t) => t.target_category === '일반') || templates[0];
    }

    const subject = replaceVariables(template.subject, lead);
    const bodyHtml = replaceVariables(template.body_html, lead);

    const { error: insertError } = await supabase
      .from('email_logs')
      .insert({
        lead_id: lead.id,
        template_id: template.id,
        subject,
        body_html: bodyHtml,
        status: 'pending',
      });

    if (insertError) {
      errors++;
    } else {
      drafted++;
    }
  }

  console.log(JSON.stringify({
    success: true,
    drafted,
    errors,
    total_leads: leads.length,
  }));
}

main();

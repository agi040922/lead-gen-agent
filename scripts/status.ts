import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

const VALID_STATUSES = ['new', 'filtered', 'contacted', 'meeting', 'negotiation', 'closed_won', 'closed_lost'];

async function main() {
  const [leadId, newStatus] = process.argv.slice(2);

  if (!leadId || !newStatus) {
    console.error(JSON.stringify({
      error: '사용법: npx tsx scripts/status.ts <lead-id> <new-status>',
      valid_statuses: VALID_STATUSES,
    }));
    process.exit(1);
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    console.error(JSON.stringify({
      error: `유효하지 않은 상태: ${newStatus}`,
      valid_statuses: VALID_STATUSES,
    }));
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ status: newStatus })
    .eq('id', leadId)
    .select('id, company_name, status')
    .single();

  if (error) {
    console.error(JSON.stringify({ error: `상태 변경 실패: ${error.message}` }));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    lead_id: data.id,
    company_name: data.company_name,
    new_status: data.status,
  }));
}

main();

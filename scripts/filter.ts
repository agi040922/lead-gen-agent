import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

async function main() {
  const [thresholdStr] = process.argv.slice(2);
  const threshold = parseInt(thresholdStr) || 60;

  // score >= threshold 이고 status가 'new'인 리드를 'filtered'로 변경
  const { data: leads, error } = await supabase
    .from('leads')
    .update({ status: 'filtered' })
    .eq('status', 'new')
    .gte('score', threshold)
    .select();

  if (error) {
    console.error(JSON.stringify({ error: `필터링 실패: ${error.message}` }));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    filtered: leads?.length || 0,
    threshold,
  }));
}

main();

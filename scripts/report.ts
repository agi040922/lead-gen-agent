import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

async function main() {
  // 전체 리드 수
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });

  // 상태별 분포
  const statuses = ['new', 'filtered', 'contacted', 'meeting', 'negotiation', 'closed_won', 'closed_lost'];
  const distribution: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    distribution[status] = count || 0;
  }

  // 이메일 통계
  const { count: totalEmails } = await supabase
    .from('email_logs')
    .select('*', { count: 'exact', head: true });

  const { count: sentEmails } = await supabase
    .from('email_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent');

  const { count: pendingEmails } = await supabase
    .from('email_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // 최근 수집 작업
  const { data: recentJobs } = await supabase
    .from('collection_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // 평균 점수
  const { data: scoreData } = await supabase
    .from('leads')
    .select('score')
    .gt('score', 0);

  const avgScore = scoreData && scoreData.length > 0
    ? Math.round(scoreData.reduce((sum, l) => sum + l.score, 0) / scoreData.length)
    : 0;

  console.log(JSON.stringify({
    success: true,
    report: {
      total_leads: totalLeads || 0,
      avg_score: avgScore,
      pipeline: distribution,
      emails: {
        total: totalEmails || 0,
        sent: sentEmails || 0,
        pending: pendingEmails || 0,
      },
      recent_jobs: recentJobs || [],
    },
  }));
}

main();

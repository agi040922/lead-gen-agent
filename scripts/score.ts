import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

// 점수 기준 (CLAUDE.md 참고)
interface ScoreResult {
  score: number;
  breakdown: Record<string, { points: number; reason: string }>;
}

function calculateScore(lead: any): ScoreResult {
  const breakdown: Record<string, { points: number; reason: string }> = {};
  let score = 0;

  // 웹사이트 없음 → +30
  if (!lead.website) {
    score += 30;
    breakdown.no_website = { points: 30, reason: '웹사이트 없음' };
  }
  // 웹사이트 구형 (HTTP, 비반응형 추정) → +20
  else if (lead.website.startsWith('http://') || !lead.website.includes('https://')) {
    score += 20;
    breakdown.old_website = { points: 20, reason: `구형 웹사이트 (${lead.website})` };
  }

  // 리뷰에 운영 불편 언급 → +20
  if (lead.review_summary) {
    const painKeywords = ['불편', '느리', '오래', '구형', '수기', '엑셀', '전화', '팩스', '수작업', '불만'];
    const matched = painKeywords.filter((kw) => lead.review_summary.includes(kw));
    if (matched.length > 0) {
      score += 20;
      breakdown.pain_reviews = { points: 20, reason: `리뷰에 불편 키워드: ${matched.join(', ')}` };
    }
  }

  // 리뷰 수로 직원 수 추정 (10~50명 규모) → +15
  if (lead.review_count >= 5 && lead.review_count <= 200) {
    score += 15;
    breakdown.mid_size = { points: 15, reason: `리뷰 ${lead.review_count}개 → 중소규모 추정` };
  }

  // 이메일 있음 → +15
  if (lead.email) {
    score += 15;
    breakdown.has_email = { points: 15, reason: `이메일 있음 (${lead.email})` };
  }

  return { score: Math.min(score, 100), breakdown };
}

async function main() {
  const [leadId] = process.argv.slice(2);

  let query = supabase.from('leads').select('*');

  if (leadId) {
    query = query.eq('id', leadId);
  } else {
    // 점수가 0인 리드만 대상
    query = query.eq('score', 0);
  }

  const { data: leads, error } = await query;

  if (error) {
    console.error(JSON.stringify({ error: `리드 조회 실패: ${error.message}` }));
    process.exit(1);
  }

  if (!leads || leads.length === 0) {
    console.log(JSON.stringify({ success: true, scored: 0, message: '점수를 매길 리드가 없습니다.' }));
    return;
  }

  let scored = 0;
  for (const lead of leads) {
    const { score, breakdown } = calculateScore(lead);
    const { error: updateError } = await supabase
      .from('leads')
      .update({ score, score_breakdown: breakdown })
      .eq('id', lead.id);

    if (updateError) {
      console.error(JSON.stringify({ error: `${lead.company_name} 점수 업데이트 실패: ${updateError.message}` }));
    } else {
      scored++;
    }
  }

  console.log(JSON.stringify({
    success: true,
    scored,
    total: leads.length,
  }));
}

main();

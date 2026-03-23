import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';
import { searchGoogleMaps } from './lib/apify';

async function main() {
  const [region, keyword, countStr] = process.argv.slice(2);

  if (!region || !keyword) {
    console.error(JSON.stringify({ error: '사용법: npx tsx scripts/collect.ts <지역> <키워드> [수량]' }));
    process.exit(1);
  }

  const count = parseInt(countStr) || 30;

  // collection_jobs 생성
  const { data: job, error: jobError } = await supabase
    .from('collection_jobs')
    .insert({ keyword, region, count, status: 'running' })
    .select()
    .single();

  if (jobError) {
    console.error(JSON.stringify({ error: `Job 생성 실패: ${jobError.message}` }));
    process.exit(1);
  }

  try {
    // Apify로 Google Maps 데이터 수집
    const results = await searchGoogleMaps({ keyword, region, maxResults: count });

    // 리뷰 텍스트를 요약 문자열로 변환
    function summarizeReviews(reviews?: { text?: string; textTranslated?: string; stars?: number }[]): string | null {
      if (!reviews || reviews.length === 0) return null;
      const texts = reviews
        .map((r) => r.text || r.textTranslated)
        .filter(Boolean)
        .map((t) => (t as string).slice(0, 100));
      if (texts.length === 0) return null;
      return texts.join(' | ');
    }

    // leads 테이블에 INSERT
    const leads = results.map((r) => ({
      company_name: r.title,
      phone: r.phone || null,
      email: r.email || null,
      website: r.website || null,
      address: r.address || null,
      category: r.categoryName || keyword,
      region,
      review_count: r.reviewsCount || 0,
      review_summary: summarizeReviews(r.reviews),
      source: 'google_maps',
      status: 'new',
      score: 0,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('leads')
      .insert(leads)
      .select();

    if (insertError) {
      throw new Error(`리드 저장 실패: ${insertError.message}`);
    }

    // job 완료 업데이트
    await supabase
      .from('collection_jobs')
      .update({ status: 'completed', result_count: inserted.length, completed_at: new Date().toISOString() })
      .eq('id', job.id);

    console.log(JSON.stringify({
      success: true,
      job_id: job.id,
      collected: inserted.length,
      region,
      keyword,
    }));
  } catch (err: any) {
    await supabase
      .from('collection_jobs')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();

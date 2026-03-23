import { config } from 'dotenv';

config({ path: '.env.local' });

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_TOKEN) {
  console.error(JSON.stringify({ error: 'APIFY_API_TOKEN이 설정되지 않았습니다.' }));
  process.exit(1);
}

const ACTOR_ID = 'compass~crawler-google-places';

interface ApifyReview {
  name?: string;
  text?: string;
  textTranslated?: string;
  stars?: number;
  publishedAtDate?: string;
}

interface ApifyGoogleMapsResult {
  title: string;
  phone?: string;
  website?: string;
  address?: string;
  categoryName?: string;
  totalScore?: number;
  reviewsCount?: number;
  reviewsDistribution?: Record<string, number>;
  email?: string;
  reviews?: ApifyReview[];
}

export async function searchGoogleMaps(params: {
  keyword: string;
  region: string;
  maxResults: number;
}): Promise<ApifyGoogleMapsResult[]> {
  const { keyword, region, maxResults } = params;

  // Apify Actor 실행
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [`${keyword} ${region}`],
        maxCrawledPlacesPerSearch: maxResults,
        language: 'ko',
        countryCode: 'kr',
        maxReviews: 10,
        scrapeReviewerName: true,
        scrapeReviewText: true,
      }),
    }
  );

  if (!runRes.ok) {
    throw new Error(`Apify 실행 실패: ${runRes.status} ${await runRes.text()}`);
  }

  const runData = await runRes.json();
  const runId = runData.data.id;

  // 완료 대기 (최대 5분)
  const MAX_WAIT = 300_000;
  const POLL_INTERVAL = 5_000;
  let elapsed = 0;

  while (elapsed < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    elapsed += POLL_INTERVAL;

    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    const statusData = await statusRes.json();

    if (statusData.data.status === 'SUCCEEDED') break;
    if (statusData.data.status === 'FAILED' || statusData.data.status === 'ABORTED') {
      throw new Error(`Apify 작업 실패: ${statusData.data.status}`);
    }
  }

  // 결과 가져오기
  const datasetRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
  );

  if (!datasetRes.ok) {
    throw new Error(`데이터셋 조회 실패: ${datasetRes.status}`);
  }

  return datasetRes.json();
}

import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabase } from './lib/supabase';

// 이메일 패턴
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 내부 링크 추출
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const hrefRegex = /href="([^"]+)"/gi;
  const links = new Set<string>();
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1];

    // 외부 링크, 앵커, javascript, mailto 제외
    if (href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('#')) continue;
    if (href.startsWith('http') && !href.includes(new URL(baseUrl).hostname)) continue;

    // 상대 경로 → 절대 경로
    if (href.startsWith('/')) {
      href = baseUrl.replace(/\/$/, '') + href;
    } else if (!href.startsWith('http')) {
      href = baseUrl.replace(/\/$/, '') + '/' + href;
    }

    // 이미지/파일 제외
    if (/\.(jpg|jpeg|png|gif|svg|pdf|zip|css|js|ico)$/i.test(href)) continue;

    links.add(href);
  }

  return Array.from(links);
}

// 이메일 우선순위 페이지 키워드 (이 키워드가 URL에 포함된 페이지를 먼저 크롤링)
const PRIORITY_KEYWORDS = ['contact', 'about', 'company', 'recruit', 'inquiry', 'support', 'info',
  '문의', '채용', '회사', '연락', '고객', '소개', 'guide', 'customer'];

// 페이지에서 이메일 추출
async function fetchAndExtractEmails(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const matches = html.match(EMAIL_REGEX) || [];

    // 가짜 이메일 필터링
    return matches.filter((email) => {
      const lower = email.toLowerCase();
      return !lower.includes('example.com') &&
        !lower.includes('yourdomain') &&
        !lower.includes('email@') &&
        !lower.endsWith('.png') &&
        !lower.endsWith('.jpg');
    });
  } catch {
    return [];
  }
}

// 웹사이트 기술 분석
interface WebsiteAnalysis {
  isHttps: boolean;
  hasViewport: boolean;    // 반응형 여부
  server: string | null;
  techStack: string[];     // jQuery, PHP, React 등
  charset: string | null;
  phones: string[];
  faxes: string[];
}

async function analyzeWebsite(url: string): Promise<WebsiteAnalysis | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const server = res.headers.get('server');

    const techStack: string[] = [];
    if (/jquery/i.test(html)) techStack.push('jQuery');
    if (/\.php/i.test(html)) techStack.push('PHP');
    if (/react/i.test(html) || /__next/i.test(html)) techStack.push('React');
    if (/vue/i.test(html)) techStack.push('Vue');
    if (/angular/i.test(html)) techStack.push('Angular');
    if (/bootstrap/i.test(html)) techStack.push('Bootstrap');
    if (/wordpress/i.test(html) || /wp-content/i.test(html)) techStack.push('WordPress');

    // 전화번호 추출
    const phoneRegex = /(\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4})/g;
    const allPhones = html.match(phoneRegex) || [];

    // 팩스 근처에 있는 번호 추출
    const faxRegex = /(?:fax|팩스|FAX)\s*[:\.]?\s*(\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4})/gi;
    const faxMatches = html.match(faxRegex) || [];
    const faxes = faxMatches.map((f) => {
      const num = f.match(/(\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4})/);
      return num ? num[1] : '';
    }).filter(Boolean);

    // charset
    let charset: string | null = null;
    if (/utf-8/i.test(html)) charset = 'UTF-8';
    else if (/euc-kr/i.test(html)) charset = 'EUC-KR';

    return {
      isHttps: url.startsWith('https://'),
      hasViewport: /viewport/i.test(html),
      server,
      techStack,
      charset,
      phones: [...new Set(allPhones)].slice(0, 5),
      faxes: [...new Set(faxes)],
    };
  } catch {
    return null;
  }
}

// 메인 enrich 로직
async function enrichLead(leadId: string) {
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error || !lead) {
    throw new Error(`리드 조회 실패: ${error?.message || 'not found'}`);
  }

  const result: any = {
    lead_id: lead.id,
    company_name: lead.company_name,
    website: lead.website,
    emails_found: [] as string[],
    website_analysis: null as WebsiteAnalysis | null,
    pages_crawled: 0,
    updated_fields: {} as Record<string, any>,
  };

  if (!lead.website) {
    return { ...result, message: '웹사이트 없음 — 보강 불가' };
  }

  const baseUrl = lead.website.replace(/\/$/, '');

  // 1단계: 메인 페이지 크롤링 + 내부 링크 수집
  const mainRes = await fetch(baseUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  });

  if (!mainRes.ok) {
    return { ...result, message: `웹사이트 접근 실패: ${mainRes.status}` };
  }

  const mainHtml = await mainRes.text();
  const mainEmails = (mainHtml.match(EMAIL_REGEX) || []).filter((e) => !e.includes('example'));
  result.emails_found.push(...mainEmails);
  result.pages_crawled = 1;

  // 내부 링크 수집
  let links = extractInternalLinks(mainHtml, baseUrl);

  // 우선순위 키워드가 포함된 링크를 앞으로 정렬
  links.sort((a, b) => {
    const aScore = PRIORITY_KEYWORDS.some((kw) => a.toLowerCase().includes(kw)) ? 0 : 1;
    const bScore = PRIORITY_KEYWORDS.some((kw) => b.toLowerCase().includes(kw)) ? 0 : 1;
    return aScore - bScore;
  });

  // 최대 15개 페이지만 크롤링
  const pagesToCrawl = links.slice(0, 15);

  // 2단계: 서브페이지 크롤링 (이메일 추출)
  for (const link of pagesToCrawl) {
    const emails = await fetchAndExtractEmails(link);
    result.emails_found.push(...emails);
    result.pages_crawled++;

    // 이메일 찾으면 조기 종료 (효율)
    if (result.emails_found.length >= 3) break;
  }

  // 중복 제거
  result.emails_found = [...new Set(result.emails_found)];

  // 3단계: 웹사이트 기술 분석
  result.website_analysis = await analyzeWebsite(baseUrl);

  // 4단계: DB 업데이트
  const updates: Record<string, any> = {};

  // 이메일이 없었는데 발견했으면 업데이트
  if (!lead.email && result.emails_found.length > 0) {
    // recruit 이메일보다 일반 이메일 우선
    const bestEmail = result.emails_found.find((e: string) => !e.includes('recruit')) || result.emails_found[0];
    updates.email = bestEmail;
  }

  // review_summary에 웹사이트 분석 결과 저장
  if (result.website_analysis) {
    const wa = result.website_analysis;
    const summary = [
      `HTTPS: ${wa.isHttps ? 'YES' : 'NO'}`,
      `반응형: ${wa.hasViewport ? 'YES' : 'NO'}`,
      `서버: ${wa.server || '알 수 없음'}`,
      `기술: ${wa.techStack.join(', ') || '알 수 없음'}`,
      wa.faxes.length > 0 ? `팩스: ${wa.faxes.join(', ')}` : null,
      result.emails_found.length > 0 ? `발견 이메일: ${result.emails_found.join(', ')}` : null,
    ].filter(Boolean).join(' | ');

    updates.review_summary = summary;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead.id);

    if (updateError) {
      console.error(`DB 업데이트 실패: ${updateError.message}`);
    }
    result.updated_fields = updates;
  }

  return result;
}

// 메인
async function main() {
  const [leadId] = process.argv.slice(2);

  if (leadId) {
    // 특정 리드 보강
    try {
      const result = await enrichLead(leadId);
      console.log(JSON.stringify({ success: true, ...result }));
    } catch (err: any) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
    return;
  }

  // 인자 없으면 웹사이트 있는 리드 전체 보강
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id')
    .not('website', 'is', null)
    .is('review_summary', null) // 아직 분석 안 한 리드만
    .limit(20);

  if (error) {
    console.error(JSON.stringify({ error: `리드 조회 실패: ${error.message}` }));
    process.exit(1);
  }

  const results = [];
  for (const lead of leads || []) {
    try {
      const result = await enrichLead(lead.id);
      results.push({ lead_id: result.lead_id, company_name: result.company_name, emails: result.emails_found, pages: result.pages_crawled });
    } catch {
      // 개별 실패는 무시하고 계속
    }
  }

  console.log(JSON.stringify({
    success: true,
    enriched: results.length,
    results,
  }));
}

main();

import { config } from 'dotenv';
config({ path: '.env.local' });

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 스크립트 실행 ──────────────────────────────────────────
// stdout에서 JSON 라인만 추출 (dotenv 로그 등 제거)
function extractJson(output: string): any {
  const lines = output.split('\n');
  // 뒤에서부터 { 로 시작하는 줄 찾기
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{')) {
      return JSON.parse(line);
    }
  }
  throw new Error('JSON not found in output');
}

function runScript(name: string, args: string[] = []): any {
  try {
    const cmd = `npx tsx scripts/${name}.ts ${args.join(' ')}`;
    const output = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 300_000 });
    return extractJson(output);
  } catch (err: any) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    try {
      return extractJson(stdout || stderr);
    } catch {
      return { error: `${name} 실행 실패: ${stderr || stdout || err.message}` };
    }
  }
}

// 재시도 래퍼 (1회 재시도)
function runWithRetry(name: string, args: string[] = []): any {
  const result = runScript(name, args);
  if (result.error) {
    log(`⚠️ ${name} 실패, 1회 재시도...`);
    const retry = runScript(name, args);
    if (retry.error) {
      return { ...retry, retried: true };
    }
    return { ...retry, retried: true };
  }
  return result;
}

// ── 로그 유틸 (stderr로 출력 — stdout은 JSON 결과 전용) ──
function log(msg: string) {
  console.error(msg);
}

// ── 파이프라인 컨텍스트 (상태 누적) ──────────────────────
interface PipelineContext {
  region: string;
  keyword: string;
  targetCount: number;
  collectedCount: number;
  emailRate: number;
  enrichedCount: number;
  avgScore: number;
  filterThreshold: number;
  filteredCount: number;
  draftedCount: number;
  sentCount: number;
  phoneOnlyCount: number;
  errors: { step: string; message: string }[];
  decisions: string[];  // 오케스트레이터가 내린 판단 기록
}

function createContext(region: string, keyword: string, count: number): PipelineContext {
  return {
    region, keyword, targetCount: count,
    collectedCount: 0, emailRate: 0, enrichedCount: 0,
    avgScore: 0, filterThreshold: 60, filteredCount: 0,
    draftedCount: 0, sentCount: 0, phoneOnlyCount: 0,
    errors: [], decisions: [],
  };
}

// ── 오케스트레이터 판단 함수들 ───────────────────────────

// collect 후: 이메일 보유율 분석 → enrich 강도 결정
async function analyzeAfterCollect(ctx: PipelineContext): Promise<'aggressive' | 'light' | 'skip'> {
  const { data: leads } = await supabase
    .from('leads')
    .select('email, website')
    .eq('status', 'new');

  if (!leads || leads.length === 0) return 'skip';

  const withEmail = leads.filter((l) => l.email).length;
  const withWebsite = leads.filter((l) => l.website).length;
  ctx.emailRate = withEmail / leads.length;

  if (ctx.emailRate >= 0.5) {
    ctx.decisions.push(`이메일 보유율 ${(ctx.emailRate * 100).toFixed(0)}% — enrich 가볍게`);
    return 'light';
  }

  if (withWebsite === 0) {
    ctx.decisions.push(`웹사이트 있는 리드 0개 — enrich 스킵`);
    return 'skip';
  }

  ctx.decisions.push(`이메일 보유율 ${(ctx.emailRate * 100).toFixed(0)}% (< 50%) — enrich 공격적 실행`);
  return 'aggressive';
}

// score 후: 최적 filter 기준 결정
async function determineFilterThreshold(ctx: PipelineContext): Promise<number> {
  const { data: leads } = await supabase
    .from('leads')
    .select('score')
    .eq('status', 'new')
    .gt('score', 0);

  if (!leads || leads.length === 0) return 60;

  // 각 기준별 통과 수 시뮬레이션
  const thresholds = [70, 60, 45, 30];
  const targetMin = Math.max(3, Math.floor(ctx.targetCount * 0.1));  // 최소 10% 또는 3개
  const targetMax = Math.floor(ctx.targetCount * 0.5);  // 최대 50%

  for (const t of thresholds) {
    const passing = leads.filter((l) => l.score >= t).length;
    if (passing >= targetMin) {
      if (passing > targetMax && t < 70) {
        // 너무 많으면 기준 올림
        ctx.decisions.push(`${t}점 기준: ${passing}개 통과 (너무 많음) → ${t + 10}점으로 상향`);
        return Math.min(t + 10, 70);
      }
      ctx.decisions.push(`${t}점 기준: ${passing}개 통과 → 적정`);
      return t;
    }
  }

  // 30점에서도 부족하면 30으로
  const at30 = leads.filter((l) => l.score >= 30).length;
  ctx.decisions.push(`모든 기준에서 부족 (30점: ${at30}개) → 최소 기준 30점 적용`);
  return 30;
}

// draft 전: 이메일 없는 리드 분류
async function classifyPhoneOnly(ctx: PipelineContext): Promise<void> {
  const { data: leads } = await supabase
    .from('leads')
    .select('id, email, phone')
    .eq('status', 'filtered');

  if (!leads) return;

  const phoneOnly = leads.filter((l) => !l.email && l.phone);
  ctx.phoneOnlyCount = phoneOnly.length;

  if (phoneOnly.length > 0) {
    ctx.decisions.push(`이메일 없고 전화만 있는 리드 ${phoneOnly.length}개 → 전화 영업 리스트`);
  }
}

// ── 퍼널 보고서 생성 ────────────────────────────────────
function generateReport(ctx: PipelineContext, results: Record<string, any>): any {
  const funnel = [
    { step: '수집', count: ctx.collectedCount },
    { step: '보강', count: ctx.enrichedCount, note: `이메일 보유율: ${(ctx.emailRate * 100).toFixed(0)}%` },
    { step: '점수', count: results.score?.scored || 0, note: `평균: ${ctx.avgScore}점` },
    { step: '필터', count: ctx.filteredCount, note: `기준: ${ctx.filterThreshold}점` },
    { step: '이메일 초안', count: ctx.draftedCount },
    ...(ctx.sentCount > 0 ? [{ step: '발송', count: ctx.sentCount }] : []),
  ];

  // 전환율 계산
  const conversionRates: string[] = [];
  for (let i = 1; i < funnel.length; i++) {
    if (funnel[i - 1].count > 0) {
      const rate = ((funnel[i].count / funnel[i - 1].count) * 100).toFixed(0);
      conversionRates.push(`${funnel[i - 1].step}→${funnel[i].step}: ${rate}%`);
    }
  }

  return {
    success: true,
    summary: {
      collected: ctx.collectedCount,
      email_rate: `${(ctx.emailRate * 100).toFixed(0)}%`,
      enriched: ctx.enrichedCount,
      avg_score: ctx.avgScore,
      filter_threshold: ctx.filterThreshold,
      filtered: ctx.filteredCount,
      emails_drafted: ctx.draftedCount,
      emails_sent: ctx.sentCount,
      phone_only: ctx.phoneOnlyCount,
    },
    funnel,
    conversion_rates: conversionRates,
    decisions: ctx.decisions,
    errors: ctx.errors,
    next_steps: [
      ctx.draftedCount > 0 ? `이메일 발송: /send-email 또는 /batch-email로 실행` : null,
      ctx.phoneOnlyCount > 0 ? `전화 영업 대상 ${ctx.phoneOnlyCount}개: /leads?status=filtered 에서 이메일 없는 리드 확인` : null,
    ].filter(Boolean),
  };
}

// ── 메인 오케스트레이터 ──────────────────────────────────
async function main() {
  const [region, keyword, countStr] = process.argv.slice(2);

  const autoSend = process.argv.includes('--send');

  if (!region || !keyword) {
    console.error(JSON.stringify({
      error: '사용법: npx tsx scripts/pipeline.ts <지역> <키워드> [수량] [--send]',
      example: 'npx tsx scripts/pipeline.ts 서울 제조공장 50 --send',
    }));
    process.exit(1);
  }

  const count = parseInt(countStr) || 30;
  const ctx = createContext(region, keyword, count);
  const results: Record<string, any> = {};

  // ── 1단계: 수집 (재시도 포함) ─────────────────────────
  log(`\n[1/5] 🔍 리드 수집 중... (${region} ${keyword} ${count}개)`);
  results.collect = runWithRetry('collect', [region, keyword, String(count)]);

  if (results.collect.error) {
    // Apify 크레딧 부족 감지
    if (results.collect.error.includes('limit') || results.collect.error.includes('exceeded')) {
      ctx.errors.push({ step: 'collect', message: 'Apify 크레딧 부족 — 업그레이드 필요' });
      log('❌ Apify 크레딧 부족. 파이프라인 중단.');
    } else {
      ctx.errors.push({ step: 'collect', message: results.collect.error });
      log(`❌ 수집 실패: ${results.collect.error}`);
    }
    console.log(JSON.stringify(generateReport(ctx, results)));
    process.exit(1);
  }

  ctx.collectedCount = results.collect.collected || 0;
  log(`   ✅ ${ctx.collectedCount}개 수집 완료`);

  // ── 2단계: 보강 (오케스트레이터 판단) ──────────────────
  const enrichMode = await analyzeAfterCollect(ctx);
  log(`\n[2/5] 🔧 리드 보강... (모드: ${enrichMode})`);

  if (enrichMode !== 'skip') {
    results.enrich = runScript('enrich');
    if (results.enrich.error) {
      ctx.errors.push({ step: 'enrich', message: results.enrich.error });
      log(`   ⚠️ 보강 실패 (스킵): ${results.enrich.error}`);
    } else {
      ctx.enrichedCount = results.enrich.enriched || 0;
      log(`   ✅ ${ctx.enrichedCount}개 보강 완료`);
    }
  } else {
    log(`   ⏭️ 보강 스킵`);
  }

  // 보강 후 이메일 보유율 재확인
  const { data: postEnrichLeads } = await supabase
    .from('leads')
    .select('email')
    .in('status', ['new', 'filtered']);
  if (postEnrichLeads) {
    const newRate = postEnrichLeads.filter((l) => l.email).length / postEnrichLeads.length;
    if (newRate > ctx.emailRate) {
      log(`   📈 이메일 보유율: ${(ctx.emailRate * 100).toFixed(0)}% → ${(newRate * 100).toFixed(0)}%`);
      ctx.emailRate = newRate;
    }
  }

  // ── 3단계: 점수 매기기 (재시도 포함) ───────────────────
  log(`\n[3/5] 📊 점수 매기기...`);
  results.score = runWithRetry('score');

  if (results.score.error) {
    ctx.errors.push({ step: 'score', message: results.score.error });
    log(`❌ 점수 단계 실패: ${results.score.error}`);
    console.log(JSON.stringify(generateReport(ctx, results)));
    process.exit(1);
  }

  log(`   ✅ ${results.score.scored}개 점수 매김`);

  // 평균 점수 계산
  const { data: scoredLeads } = await supabase
    .from('leads')
    .select('score')
    .gt('score', 0);
  if (scoredLeads && scoredLeads.length > 0) {
    ctx.avgScore = Math.round(scoredLeads.reduce((sum, l) => sum + l.score, 0) / scoredLeads.length);
  }

  // ── 4단계: 필터링 (오케스트레이터가 기준 결정) ─────────
  ctx.filterThreshold = await determineFilterThreshold(ctx);
  log(`\n[4/5] 🎯 필터링... (기준: ${ctx.filterThreshold}점)`);

  results.filter = runScript('filter', [String(ctx.filterThreshold)]);

  if (results.filter.error) {
    ctx.errors.push({ step: 'filter', message: results.filter.error });
    log(`❌ 필터 단계 실패: ${results.filter.error}`);
    console.log(JSON.stringify(generateReport(ctx, results)));
    process.exit(1);
  }

  ctx.filteredCount = results.filter.filtered || 0;
  log(`   ✅ ${ctx.filteredCount}개 필터 통과`);

  // ── 5단계: 이메일 초안 생성 (전화 영업 리드 분류) ──────
  await classifyPhoneOnly(ctx);
  log(`\n[5/5] ✉️ 이메일 초안 생성...`);

  if (ctx.filteredCount === 0) {
    ctx.decisions.push('필터 통과 리드 0개 — 이메일 초안 생성 스킵');
    log(`   ⏭️ 필터 통과 리드 없음, 이메일 초안 스킵`);
  } else {
    results.draftEmail = runScript('draft-email');
    if (results.draftEmail?.error) {
      ctx.errors.push({ step: 'draft-email', message: results.draftEmail.error });
      log(`   ⚠️ 이메일 초안 실패: ${results.draftEmail.error}`);
    } else {
      ctx.draftedCount = results.draftEmail?.drafted || 0;
      log(`   ✅ ${ctx.draftedCount}개 이메일 초안 생성`);
    }
  }

  if (ctx.phoneOnlyCount > 0) {
    log(`   📞 전화 영업 대상: ${ctx.phoneOnlyCount}개`);
  }

  // ── 6단계: 이메일 발송 (--send 플래그 시) ─────────────────
  if (autoSend && ctx.draftedCount > 0) {
    log(`\n[6/6] 📤 이메일 발송 중... (--send 활성화)`);

    // pending 상태의 이메일이 있는 리드 조회
    const { data: pendingLogs } = await supabase
      .from('email_logs')
      .select('lead_id')
      .eq('status', 'pending');

    const leadIds = [...new Set((pendingLogs || []).map((l) => l.lead_id).filter(Boolean))];
    let sent = 0;
    let sendErrors = 0;

    for (const leadId of leadIds) {
      const result = runScript('send-email', [leadId]);
      if (result.error) {
        sendErrors++;
      } else {
        sent++;
      }
    }

    ctx.sentCount = sent;
    if (sendErrors > 0) {
      ctx.errors.push({ step: 'send-email', message: `${sendErrors}개 발송 실패` });
    }
    log(`   ✅ ${sent}개 발송 완료${sendErrors > 0 ? ` (${sendErrors}개 실패)` : ''}`);
    ctx.decisions.push(`--send 플래그 → ${sent}개 이메일 자동 발송`);
  } else if (!autoSend && ctx.draftedCount > 0) {
    log(`\n   💡 이메일 ${ctx.draftedCount}개 대기 중 — 발송하려면 --send 플래그를 추가하세요`);
  }

  // ── 최종 보고서 ─────────────────────────────────────────
  const report = generateReport(ctx, results);

  log('\n══════════════════════════════════════════');
  log('📋 파이프라인 완료 보고서');
  log('══════════════════════════════════════════');
  log(`수집: ${ctx.collectedCount} → 보강: ${ctx.enrichedCount} → 필터(${ctx.filterThreshold}점): ${ctx.filteredCount} → 이메일: ${ctx.draftedCount}${ctx.sentCount > 0 ? ` → 발송: ${ctx.sentCount}` : ''}`);
  log(`이메일 보유율: ${(ctx.emailRate * 100).toFixed(0)}% | 평균 점수: ${ctx.avgScore}점`);
  if (ctx.phoneOnlyCount > 0) log(`📞 전화 영업 대상: ${ctx.phoneOnlyCount}개`);
  if (ctx.decisions.length > 0) {
    log('\n🤖 오케스트레이터 판단:');
    ctx.decisions.forEach((d) => log(`   • ${d}`));
  }
  if (ctx.errors.length > 0) {
    log('\n⚠️ 오류:');
    ctx.errors.forEach((e) => log(`   • [${e.step}] ${e.message}`));
  }
  log('══════════════════════════════════════════\n');

  console.log(JSON.stringify(report));
}

main();

import { config } from 'dotenv';
config({ path: '.env.local' });

import { execSync } from 'child_process';

function runScript(name: string, args: string[] = []): any {
  try {
    const cmd = `npx tsx scripts/${name}.ts ${args.join(' ')}`;
    const output = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() });
    return JSON.parse(output.trim());
  } catch (err: any) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    try {
      return JSON.parse(stdout.trim() || stderr.trim());
    } catch {
      return { error: `${name} 실행 실패: ${stderr || stdout || err.message}` };
    }
  }
}

async function main() {
  const [region, keyword, countStr] = process.argv.slice(2);

  if (!region || !keyword) {
    console.error(JSON.stringify({
      error: '사용법: npx tsx scripts/pipeline.ts <지역> <키워드> [수량]',
      example: 'npx tsx scripts/pipeline.ts 서울 제조공장 50',
    }));
    process.exit(1);
  }

  const count = countStr || '30';
  const results: Record<string, any> = {};

  // 1. 수집
  console.error('[1/4] 리드 수집 중...');
  results.collect = runScript('collect', [region, keyword, count]);
  if (results.collect.error) {
    console.error(JSON.stringify({ error: `수집 단계 실패: ${results.collect.error}`, step: 'collect' }));
    process.exit(1);
  }

  // 2. 점수 매기기
  console.error('[2/4] 점수 매기기 중...');
  results.score = runScript('score');
  if (results.score.error) {
    console.error(JSON.stringify({ error: `점수 단계 실패: ${results.score.error}`, step: 'score' }));
    process.exit(1);
  }

  // 3. 필터링 (60점 이상)
  console.error('[3/4] 필터링 중...');
  results.filter = runScript('filter', ['60']);
  if (results.filter.error) {
    console.error(JSON.stringify({ error: `필터 단계 실패: ${results.filter.error}`, step: 'filter' }));
    process.exit(1);
  }

  // 4. 이메일 초안 생성
  console.error('[4/4] 이메일 초안 생성 중...');
  results.draftEmail = runScript('draft-email');
  if (results.draftEmail.error) {
    console.error(JSON.stringify({ error: `이메일 초안 단계 실패: ${results.draftEmail.error}`, step: 'draft-email' }));
    process.exit(1);
  }

  console.log(JSON.stringify({
    success: true,
    summary: {
      collected: results.collect.collected || 0,
      scored: results.score.scored || 0,
      filtered: results.filter.filtered || 0,
      emails_drafted: results.draftEmail.drafted || 0,
    },
    details: results,
    next_step: '이메일 발송은 /send-email로 별도 컨펌 후 실행하세요.',
  }));
}

main();

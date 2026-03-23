# 시작 프롬프트

## 한번에 전부 만들기

```
CLAUDE.md 읽고, .omc/specs/lead-gen-agent.yaml 스펙 읽어.

이 프로젝트를 처음부터 끝까지 전부 만들어줘. 중간에 멈추지 말고 끝까지.

### 1. 프로젝트 세팅
- Next.js 초기화 (pnpm, App Router, TypeScript, Tailwind CSS)
- Supabase 클라이언트 설정
- DB 스키마 SQL 파일 생성 (supabase/schema.sql) — CLAUDE.md 참고
- .env.local.example 파일 생성 (실제 값은 나중에 넣음)

### 2. 스크립트 만들기 (핵심!)
CLAUDE.md의 "스크립트 구조" 섹션 참고해서 scripts/ 폴더에 실행 가능한 TypeScript 스크립트를 만들어줘:

scripts/lib/supabase.ts — Supabase 클라이언트 (SERVICE_ROLE_KEY로 DB 직접 접근)
scripts/lib/apify.ts — Apify API 클라이언트
scripts/collect.ts — Apify Google Maps API로 리드 수집 → leads 테이블 INSERT + collection_jobs 기록
scripts/score.ts — 리드 점수 매기기 → leads.score UPDATE (CLAUDE.md 점수 기준)
scripts/filter.ts — 점수 기준 필터링 → leads.status를 filtered로 UPDATE
scripts/draft-email.ts — email_templates에서 업종 맞는 템플릿 가져와서 변수 치환 → email_logs에 pending INSERT
scripts/send-email.ts — Resend API로 이메일 발송 → email_logs.status를 sent로 UPDATE
scripts/batch-email.ts — filtered 상태 리드 일괄 이메일 생성
scripts/status.ts — 리드 파이프라인 상태 변경
scripts/report.ts — 현재 파이프라인 현황 조회 + 요약 출력
scripts/pipeline.ts — 위 스크립트를 순차 호출 (collect → score → filter → draft-email)

모든 스크립트는:
- dotenv로 .env.local 환경변수 로드
- npx tsx scripts/{name}.ts 인자1 인자2 로 실행 가능
- 실행 결과를 stdout JSON으로 출력
- 에러 시 exit code 1

### 3. Claude Code 스킬 만들기
.claude/skills/ 폴더에 각 스크립트를 실행하는 스킬 파일 만들어줘:

- /collect — scripts/collect.ts 실행
- /score — scripts/score.ts 실행
- /filter — scripts/filter.ts 실행
- /draft-email — scripts/draft-email.ts 실행
- /send-email — scripts/send-email.ts 실행
- /batch-email — scripts/batch-email.ts 실행
- /status — scripts/status.ts 실행
- /report — scripts/report.ts 실행
- /pipeline — scripts/pipeline.ts 실행 (전체 파이프라인 자동화)

각 스킬은 스크립트 실행 결과를 읽고 사용자에게 보고하는 역할.

### 4. GUI (데이터 뷰어)
GUI는 DB 데이터를 보여주는 용도. 디자인은 미니멀, 검정/흰색 베이스.

- / 대시보드: 총 리드 수, 단계별 분포, 최근 수집 이력
- /leads: 리드 목록 테이블 (필터 + 검색 + 상태 표시)
- /leads/[id]: 리드 상세 (정보 + 이메일 이력 + 메모)
- /pipeline: 파이프라인 보드 (단계별 칸반 뷰)
- /emails: 이메일 템플릿 목록 조회
- /jobs: 수집 작업 이력 조회

### 5. 시드 데이터
이메일 템플릿 3종 SQL (제조/물류용, 의료/병원용, 일반 중소기업용)을 supabase/seed.sql에 넣어줘.

다 만들면 pnpm dev로 GUI 실행 가능하고, npx tsx scripts/pipeline.ts 서울 제조공장 50 으로 파이프라인 실행 가능한 상태까지 해줘.
```

## 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APIFY_API_TOKEN=
RESEND_API_KEY=
```

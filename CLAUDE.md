# Lead Generation Agent

## Spec
- 상세 스펙: `.omc/specs/lead-gen-agent.yaml`

## 프로젝트 개요

Google Maps에서 노후 ERP/CRM 사용 중소기업 리드를 자동 수집하고,
맞춤 이메일을 자동 생성/발송하며, 전체 영업 파이프라인을 웹 GUI로 관리하는 시스템.

## 아키텍처

```
[Claude Code] --API호출--> [Google Maps / Apify]
      |
      v
  [Supabase DB] <--조회-- [Next.js GUI]
      |
      v
  [이메일 발송] --Gmail/Resend API-->
```

- **엔진**: Claude Code (서버에서 실행, 리드 수집/필터링/이메일 생성·발송)
- **DB**: Supabase (PostgreSQL)
- **GUI**: Next.js (리드 목록 + 파이프라인 관리 대시보드)
- **데이터 소스**: Google Maps API (Apify 활용)

## 데이터베이스 스키마

### leads 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| company_name | text | 업체명 |
| phone | text | 전화번호 |
| email | text | 이메일 |
| website | text | 웹사이트 URL |
| address | text | 주소 |
| category | text | 업종 (제조, 의료, 프랜차이즈 등) |
| region | text | 지역 |
| review_count | int | 리뷰 수 |
| review_summary | text | 리뷰 요약 |
| score | int (0~100) | 리드 점수 |
| status | text | 파이프라인 단계 |
| source | text | 데이터 소스 (google_maps 등) |
| notes | text | 메모 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### status 값 (파이프라인)
- `new`: 신규 수집
- `filtered`: 필터링 통과
- `contacted`: 1차 접촉 완료
- `meeting`: 미팅 예정/완료
- `negotiation`: 협상 중
- `closed_won`: 계약 완료
- `closed_lost`: 실패/포기

### email_templates 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| name | text | 템플릿 이름 |
| subject | text | 제목 ({{company_name}} 등 변수 포함) |
| body_html | text | HTML 본문 ({{변수}} 치환) |
| target_category | text | 대상 업종 |
| created_at | timestamptz | |

### email_logs 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| lead_id | uuid (FK) | leads.id |
| template_id | uuid (FK) | email_templates.id |
| subject | text | 실제 발송된 제목 |
| body_html | text | 실제 발송된 본문 |
| status | text | sent / failed / pending |
| sent_at | timestamptz | |

### collection_jobs 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| keyword | text | 검색 키워드 |
| region | text | 검색 지역 |
| count | int | 수집 목표 수 |
| status | text | running / completed / failed |
| result_count | int | 실제 수집 수 |
| created_at | timestamptz | |
| completed_at | timestamptz | |

## Claude Code 스킬 + 스크립트 (핵심)

이 프로젝트의 핵심 엔진은 Claude Code다. GUI는 데이터 뷰어일 뿐이고,
실제 리드 수집/필터링/이메일 생성·발송은 전부 Claude Code 스킬로 실행한다.

**각 스킬은 `scripts/` 폴더의 TypeScript 스크립트를 실행하여 Supabase DB에 직접 CRUD를 수행한다.**

### 스킬 구조 (.claude/skills/)

| 스킬 | 실행 스크립트 | 용도 | 사용 예시 |
|------|-------------|------|-----------|
| `/collect` | `scripts/collect.ts` | Apify로 리드 수집 → DB 저장 | `/collect 서울 제조공장 50` |
| `/score` | `scripts/score.ts` | 리드 점수 매기기 → DB 업데이트 | `/score` 또는 `/score lead-id` |
| `/filter` | `scripts/filter.ts` | 점수 기준 필터링 → status 변경 | `/filter 60` |
| `/draft-email` | `scripts/draft-email.ts` | 맞춤 이메일 초안 생성 → DB 저장 | `/draft-email lead-id` |
| `/send-email` | `scripts/send-email.ts` | 이메일 발송 → email_logs 기록 | `/send-email lead-id` |
| `/batch-email` | `scripts/batch-email.ts` | 일괄 이메일 생성 | `/batch-email filtered 10` |
| `/status` | `scripts/status.ts` | 리드 상태 변경 → DB 업데이트 | `/status lead-id contacted` |
| `/report` | `scripts/report.ts` | 파이프라인 현황 조회 | `/report` |
| **`/pipeline`** | **전체 파이프라인** | **collect→score→filter→draft-email 한번에** | **`/pipeline 서울 제조공장 50`** |

### 핵심: /pipeline 스킬 (전체 자동화)

```
/pipeline 서울 제조공장 50
  ↓
1. collect: Apify API → Google Maps 스크래핑 → leads 테이블 INSERT + collection_jobs 기록
  ↓
2. score: 수집된 리드 점수 매기기 → leads.score UPDATE
  ↓
3. filter: 60점 이상 → leads.status = 'filtered' UPDATE
  ↓
4. draft-email: filtered 리드에 맞춤 이메일 생성 → email_logs에 pending으로 INSERT
  ↓
5. 결과 보고: "47개 수집, 32개 필터 통과, 32개 이메일 초안 생성 완료"
  ↓
(발송은 /send-email로 별도 컨펌 후 실행)
```

### 스크립트 구조 (scripts/)

모든 스크립트는 TypeScript로 작성하며, `npx tsx scripts/{name}.ts` 로 실행 가능.
각 스크립트는:
- `.env.local`에서 환경변수 로드 (dotenv)
- Supabase 클라이언트로 DB CRUD 수행
- 실행 결과를 stdout으로 출력 (Claude Code가 읽음)
- 에러 시 exit code 1 + 에러 메시지

```
scripts/
├── lib/
│   ├── supabase.ts        # Supabase 클라이언트 (SERVICE_ROLE_KEY 사용)
│   └── apify.ts           # Apify API 클라이언트
├── collect.ts             # 리드 수집
├── score.ts               # 점수 매기기
├── filter.ts              # 필터링
├── draft-email.ts         # 이메일 초안 생성
├── send-email.ts          # 이메일 발송
├── batch-email.ts         # 일괄 이메일
├── status.ts              # 상태 변경
├── report.ts              # 현황 보고
└── pipeline.ts            # 전체 파이프라인 (위 스크립트를 순차 호출)
```

### 환경변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # 스크립트가 DB 직접 접근용
APIFY_API_TOKEN=
RESEND_API_KEY=
```

## GUI (데이터 뷰어)

GUI는 Supabase에 쌓인 데이터를 보여주는 용도.
데이터 수집/수정/발송 등 액션은 Claude Code 커맨드로 한다.

## 개발 명령어

```bash
pnpm dev          # GUI 개발 서버
pnpm build        # GUI 빌드
pnpm lint         # 린트
```

## 패키지 매니저
pnpm 사용

## GUI 구성 (페이지)

- `/` — 대시보드 (통계 요약)
- `/leads` — 리드 목록 (테이블 + 필터 + 검색 + 상태 변경)
- `/leads/[id]` — 리드 상세 (정보 + 이메일 이력 + 메모)
- `/pipeline` — 파이프라인 보드 (칸반 또는 단계별 뷰)
- `/emails` — 이메일 템플릿 관리
- `/jobs` — 수집 작업 이력

## 리드 점수 기준 (score)

| 기준 | 점수 |
|------|------|
| 웹사이트 없음 | +30 |
| 웹사이트 구형 (HTTP, 비반응형) | +20 |
| 리뷰에 운영 불편 언급 | +20 |
| 직원 수 10~50명 추정 | +15 |
| 이메일 있음 | +15 |

## 커밋 규칙
- 한국어로 커밋 메시지 작성
- conventional commit 형식 (feat:, fix:, chore: 등)

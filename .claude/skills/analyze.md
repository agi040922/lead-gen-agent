---
description: "고점수 리드의 웹사이트를 Jina Reader로 크롤링하여 Claude가 직접 분석하고, 인사이트 공유형 맞춤 이메일을 작성합니다."
---

# /analyze 스킬

## 사용법
```
/analyze <lead-id>
/analyze          # filtered 상태 + 50점 이상 리드 자동 선택
```

## 실행 흐름

### 1단계: 리드 정보 조회
Supabase에서 리드 데이터를 조회한다 (execute_sql 또는 스크립트).
- company_name, website, email, category, region, score, score_breakdown, review_summary

### 2단계: 웹사이트 크롤링 (Jina Reader)
Jina Reader API로 웹사이트를 마크다운으로 가져온다.

```bash
curl -s "https://r.jina.ai/{website_url}" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Accept: text/plain"
```

**왜 Jina Reader?**
- JS 렌더링 사이트도 대응 (브라우저 렌더링 후 반환)
- 마크다운으로 반환되어 Claude가 바로 읽고 분석 가능
- 푸터, 사이드바 등 전체 콘텐츠 포함

### 3단계: Claude가 직접 분석
가져온 마크다운 + enrich 데이터를 바탕으로 Claude가 직접 분석:

**분석 항목:**
- 업체가 하는 일 (업종, 규모 추정)
- 주문/문의 흐름 (온라인 주문 가능? 수기 처리?)
- 기술 수준 (HTTP/HTTPS, 반응형, 기술 스택)
- 데이터 관리 방식 추정 (ERP 사용 여부, 엑셀 추정)
- 문제 가설 3개 생성

### 4단계: 맞춤 이메일 작성
**템플릿 변수 치환이 아니라 Claude가 직접 작성한다.**

기존 템플릿은 톤/구조 참고용으로만 사용하고,
리드의 실제 상황에 맞는 1:1 이메일을 생성한다.

**이메일 작성 규칙:**
- 톤: 인사이트 공유형 (광고 ❌)
- "검사했다" ❌ → "관찰 + 가능성 제시" ⭕
- "사이트를 보면서 이런 흐름이 보였습니다" 식으로
- 가격/제품 직접 언급 ❌
- CTA: "혹시 비슷한 부분을 고민하고 계신지 궁금합니다"
- 수신거부: "원치 않으시면 편하게 말씀 주세요" 포함
- 하단: Lightsoft | AI Workflow & Service / lightsoft.dev / 010-4231-8118
- 로고: <img src="https://rhthijurrjdklrzpqkcg.supabase.co/storage/v1/object/public/logos/lightsoft-logo.png" alt="Lightsoft" height="40" />

**이메일 구조:**
```
[Lightsoft 로고]

{company_name} 대표님께

{웹사이트 관찰 기반 인사이트 1~2줄}
{이런 구조에서 보통 발생하는 문제 설명}
{공감 + 질문}

원치 않으시면 편하게 말씀 주세요.

────────────────────
Lightsoft | AI Workflow & Service
lightsoft.dev | 010-4231-8118
```

### 5단계: DB 저장
- email_logs에 pending으로 INSERT (template_id = null, Claude가 직접 쓴 것)
- leads.analysis_report에 분석 결과 jsonb 저장

### 6단계: 사용자에게 보고
- 분석 결과 요약
- 생성된 이메일 제목/미리보기
- "발송은 /send-email로 별도 실행하세요"

## 파이프라인 연동
pipeline.ts의 오케스트레이터가 점수에 따라 자동 분기:
- 50점+ → /analyze (Claude 심층 분석 + 맞춤 이메일)
- 50점 미만 → /draft-email (기존 템플릿 방식)

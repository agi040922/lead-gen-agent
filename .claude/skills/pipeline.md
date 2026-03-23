---
description: "전체 리드 생성 파이프라인을 한번에 실행합니다. 수집 → 점수 → 필터 → 이메일 초안 생성을 순차 실행합니다."
---

# /pipeline 스킬

## 사용법
```
/pipeline <지역> <키워드> [수량]
```

## 예시
```
/pipeline 서울 제조공장 50
/pipeline 부산 병원 30
```

## 실행 방법
```bash
npx tsx scripts/pipeline.ts <지역> <키워드> [수량]
```

## 파이프라인 단계
1. **collect**: Apify → Google Maps 스크래핑 → leads INSERT
2. **score**: 리드 점수 매기기 → leads.score UPDATE
3. **filter**: 60점 이상 → leads.status = 'filtered'
4. **draft-email**: filtered 리드에 이메일 초안 생성 → email_logs INSERT

## 실행 후
- 각 단계별 결과를 요약해서 보고하세요
- "이메일 발송은 /send-email로 별도 컨펌 후 실행하세요" 안내

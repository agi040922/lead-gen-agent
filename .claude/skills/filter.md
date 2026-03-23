---
description: "점수 기준으로 리드를 필터링합니다. 기준 점수 이상인 리드의 상태를 'filtered'로 변경합니다."
---

# /filter 스킬

## 사용법
```
/filter [기준점수]
```

## 예시
```
/filter           # 기본 60점 이상 필터링
/filter 70        # 70점 이상만 필터링
```

## 실행 방법
```bash
npx tsx scripts/filter.ts [기준점수]
```

## 실행 후
- 필터링 통과한 리드 수와 기준 점수를 보고하세요

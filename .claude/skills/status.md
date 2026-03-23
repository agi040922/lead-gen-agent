---
description: "리드의 파이프라인 상태를 변경합니다. new, filtered, contacted, meeting, negotiation, closed_won, closed_lost 중 선택."
---

# /status 스킬

## 사용법
```
/status <lead-id> <상태>
```

## 예시
```
/status abc-123-def contacted
/status abc-123-def meeting
/status abc-123-def closed_won
```

## 실행 방법
```bash
npx tsx scripts/status.ts <lead-id> <상태>
```

## 유효한 상태값
- new, filtered, contacted, meeting, negotiation, closed_won, closed_lost

## 실행 후
- 변경된 리드의 이름과 새 상태를 보고하세요

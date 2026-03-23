---
description: "filtered 상태 리드에 일괄 이메일 초안을 생성합니다."
---

# /batch-email 스킬

## 사용법
```
/batch-email [상태] [수량]
```

## 예시
```
/batch-email filtered 10    # filtered 상태 리드 10개에 이메일 생성
/batch-email new 20         # new 상태 리드 20개에 이메일 생성
```

## 실행 방법
```bash
npx tsx scripts/batch-email.ts [상태] [수량]
```

## 실행 후
- 생성된 이메일 초안 수와 에러 수를 보고하세요

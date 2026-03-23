---
description: "리드에 맞춤 이메일 초안을 생성합니다. 업종에 맞는 템플릿을 선택하고 변수를 치환하여 email_logs에 pending 상태로 저장합니다."
---

# /draft-email 스킬

## 사용법
```
/draft-email [lead-id]
```

## 예시
```
/draft-email                # filtered 상태 리드 전체에 이메일 초안 생성
/draft-email abc-123-def    # 특정 리드에 이메일 초안 생성
```

## 실행 방법
```bash
npx tsx scripts/draft-email.ts [lead-id]
```

## 실행 후
- 생성된 이메일 초안 수를 보고하세요
- 에러가 있었으면 에러 수도 알려주세요

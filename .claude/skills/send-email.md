---
description: "Resend API로 이메일을 발송합니다. 리드의 pending 이메일을 실제 발송하고 상태를 sent로 업데이트합니다."
---

# /send-email 스킬

## 사용법
```
/send-email <lead-id>
```

## 예시
```
/send-email abc-123-def
```

## 실행 방법
⚠️ 발송 전 반드시 사용자에게 확인을 받으세요! 실제 이메일이 발송됩니다.

```bash
npx tsx scripts/send-email.ts <lead-id>
```

## 실행 후
- 발송 결과 (성공/실패)를 보고하세요
- 발송된 이메일 주소와 제목을 알려주세요

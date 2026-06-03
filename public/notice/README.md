# 공지 이미지 (로컬 테스트용)

로컬 실행(`BLOB_READ_WRITE_TOKEN` 미설정) 시 이 디렉토리의 이미지가 업데이트 공지에 사용됩니다.
운영(Vercel)에서는 이 폴더 대신 Vercel Blob의 `notice/` 폴더를 사용합니다.

## 사용법

1. 이미지 파일을 이 폴더에 둡니다 (png·jpg·jpeg·gif·webp·svg·avif).
2. 파일명(확장자 제외)을 `NEXT_PUBLIC_NOTICE`의 `items[].image` 값으로 지정합니다.

예) `public/notice/stock-xray.jpg` →
```json
{ "headline": "🔍 주식 X-Ray 출시", "image": "stock-xray" }
```

`/api/notice/images`가 `{ "stock-xray": "/notice/stock-xray.jpg" }` 형태로 매핑을 반환합니다.

> 이 폴더의 이미지 파일은 git에 커밋하지 않습니다(.gitignore). README만 유지합니다.

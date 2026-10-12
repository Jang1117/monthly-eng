# Worker에 사용자 목록 API 추가하기 (선택 사항)

새 index.html의 사용자 추가/삭제 기능은 서버에 `/users` API가 있으면
팀원 목록을 서버에 저장해 모든 기기에서 공유하고, 없으면 각 브라우저의
localStorage에만 저장합니다. 서버 공유를 원하면 아래 스니펫을 Worker 코드에 추가하세요.

## 추가할 코드

Worker의 `fetch` 핸들러 안에서 URL 라우팅하는 부분에 추가:

```js
// ===== 사용자 목록 API =====
// 'USERS_KV'는 실제 KV 네임스페이스 바인딩 이름으로 바꾸세요.
// (이벤트 저장에 쓰는 것과 같은 KV를 써도 됩니다.)
if (url.pathname === '/users' && request.method === 'GET') {
  const raw = await env.USERS_KV.get('users');
  return Response.json(raw ? JSON.parse(raw) : []);
}
if (url.pathname === '/users' && request.method === 'PUT') {
  const list = await request.json(); // [{ id, name, color }, ...]
  await env.USERS_KV.put('users', JSON.stringify(list));
  return Response.json({ ok: true });
}
```

## 초기 사용자 등록 (최초 1회)

배포 후 아래 명령으로 현재 팀원 2명을 등록하세요.
(KV 바인딩 없이 curl로 바로 호출 — Worker가 위 코드를 서빙 중이어야 함)

```bash
curl -X PUT https://monthly-eng.jang1117.workers.dev/users \
  -H 'Content-Type: application/json' \
  -d '[{"id":"yang","name":"양성민","color":"#f87171"},{"id":"jang","name":"장승호","color":"#60a5fa"}]'
```

## 참고

- `/users`가 404여도 앱은 정상 동작합니다 (localStorage 폴백).
- 기존 이벤트 데이터는 건드리지 않습니다.

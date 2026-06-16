# STEAL BINGO PRO — 팀 대항 HRD 교육용 빙고 게임

기업 교육(HRD) 현장용 빙고 게임입니다. 세 가지 모드를 제공합니다.

- **🖥️ 로컬 게임** — 한 화면(프로젝터)에서 팀이 번갈아 진행하는 기존 핫시트 방식
- **🌐 온라인 멀티** — 여러 기기로 접속하는 실시간 멀티플레이 (조별/개인 경쟁, 턴제)
- **🛠️ 문제 관리자** — 문제 출제·등록·수정·삭제 (서버에 JSON 으로 영구 저장)

## 구조

- **클라이언트**: React + Vite (`App.tsx` 의 해시 라우터 → `pages/`)
- **서버**: Node + Express + Socket.IO (`server/`)
  - 문제은행 REST API + JSON 영구 저장 (`server/data/questions.json`, 최초 실행 시 `questions.seed.json` 으로 시드)
  - 방(room) 기반 실시간 게임. **게임 상태의 권위는 서버**에 있으며, 정답/문제 본문은 클라이언트로 전송되지 않습니다.
  - **문제 비공개**: 턴제 진행 중 현재 차례인 팀의 기기에만 문제를 비공개로 전송하고, 다른 조와 호스트(프로젝터)에는 "○○팀이 문제 푸는 중"만 표시됩니다.

## 로컬 실행 (개발)

**필요:** Node.js 18+

```bash
npm install
npm run dev:all   # 서버(:3001) + 클라이언트(:5000) 동시 실행
```

- 진행자/프로젝터: 브라우저에서 `http://localhost:5000` → 온라인 멀티 → 방 만들기
- 같은 와이파이의 참가자: `http://<이 PC의 LAN IP>:5000` 로 접속 → 온라인 멀티 → 방 참가 → 방 코드 입력
  - PC IP 확인: `ipconfig` (Windows) 의 IPv4 주소
- 서버만/클라만 따로: `npm run server` / `npm run dev`

## 배포 (클라우드)

단일 Node 프로세스가 빌드된 클라이언트와 소켓을 모두 서빙합니다.

```bash
npm run build     # dist/ 생성
npm start         # = node server/index.mjs (PORT 환경변수 사용, 기본 3001)
```

Render/Railway 등에서 Build Command `npm install && npm run build`, Start Command `npm start` 로 배포하면 됩니다. 클라이언트는 같은 오리진의 소켓에 자동 연결됩니다.

## 게임 규칙 요약

- 빈 칸 선점: 퀴즈 정답 시 점령(QUIZ) 또는 즉시 점령(IMMEDIATE)
- 스틸: 상대 칸을 미니게임으로 빼앗기 (팀별 횟수 제한 설정 가능)
- 승리: 보드 크기별 목표 빙고 줄 수 달성 (4×4=2줄, 5×5=3줄, 7×7=4줄)

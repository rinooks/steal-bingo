// 게임 엔진 — 보드 생성, 빙고 판정(스틸/파괴 포함), 정답 채점
import { winThresholdFor } from './config.mjs';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 보드 생성: 카테고리 문제에서 size*size 개를 무작위 선택
export function buildBoard(categoryQuizzes, size) {
  const need = size * size;
  if (categoryQuizzes.length < need) {
    throw new Error(`문제 수(${categoryQuizzes.length})가 보드 크기(${need})보다 부족합니다.`);
  }
  const selected = shuffle(categoryQuizzes).slice(0, need);
  return selected.map((quiz, idx) => ({
    index: idx,
    keyword: quiz.keyword,
    quiz,
    owner: null,
    isLocked: false,
  }));
}

// 모든 라인 패턴 (행/열/대각)
function linePatterns(size) {
  const patterns = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(r * size + c);
    patterns.push({ id: `row-${r}`, indices: row });
  }
  for (let c = 0; c < size; c++) {
    const col = [];
    for (let r = 0; r < size; r++) col.push(r * size + c);
    patterns.push({ id: `col-${c}`, indices: col });
  }
  const diag1 = [];
  const diag2 = [];
  for (let i = 0; i < size; i++) {
    diag1.push(i * size + i);
    diag2.push(i * size + (size - 1 - i));
  }
  patterns.push({ id: 'diag-1', indices: diag1 });
  patterns.push({ id: 'diag-2', indices: diag2 });
  return patterns;
}

// 빙고 판정 — App.tsx 의 checkBingo 로직을 서버용으로 포팅.
// room.board / room.teams / room.completedLines / room.winningLines 를 직접 갱신하고
// 발생한 로그와 newBingo 여부를 반환한다.
export function checkBingo(room) {
  const size = room.boardSize;
  const patterns = linePatterns(size);
  const board = room.board;
  const logs = [];
  let newBingoFound = false;

  // 1. 기존 완성 라인이 여전히 유효한지 (스틸로 끊겼는지)
  const broken = [];
  for (const lineUniqueId of room.completedLines) {
    const [teamIdStr, ...lineIdParts] = lineUniqueId.split('-');
    const teamId = parseInt(teamIdStr, 10);
    const lineId = lineIdParts.join('-');
    const pattern = patterns.find((p) => p.id === lineId);
    if (!pattern) continue;
    const stillOwns = pattern.indices.every((idx) => board[idx].owner === teamId);
    if (!stillOwns) {
      broken.push(lineUniqueId);
      const team = room.teams.find((t) => t.id === teamId);
      if (team) {
        team.bingoCount = Math.max(0, team.bingoCount - 1);
        logs.push(`💔 ${team.name}의 빙고 라인이 끊어졌습니다!`);
      }
    }
  }
  if (broken.length > 0) {
    room.completedLines = room.completedLines.filter((id) => !broken.includes(id));
    room.winningLines = room.winningLines.filter((line) => !broken.includes(line.id));
  }

  // 2. 새 빙고 라인 탐색
  for (const team of room.teams) {
    for (const pattern of patterns) {
      const isFull = pattern.indices.every((idx) => board[idx].owner === team.id);
      const lineUniqueId = `${team.id}-${pattern.id}`;
      if (isFull && !room.completedLines.includes(lineUniqueId)) {
        room.completedLines.push(lineUniqueId);
        newBingoFound = true;
        team.bingoCount += 1;
        room.winningLines.push({
          id: lineUniqueId,
          startIndex: pattern.indices[0],
          endIndex: pattern.indices[pattern.indices.length - 1],
          color: team.hex,
        });
      }
    }
  }

  // 3. 승자 결정
  const threshold = winThresholdFor(size);
  let winner = null;
  for (const team of room.teams) {
    if (team.bingoCount >= threshold && winner === null) winner = team.id;
  }

  if (newBingoFound) logs.push('BINGO 발생!');
  if (winner !== null) {
    const w = room.teams.find((t) => t.id === winner);
    logs.push(`🏆 ${w?.name} 승리!`);
    room.winner = winner;
    room.status = 'gameover';
  }

  return { logs, newBingoFound, winner };
}

// 정답 채점 (QuizModal 의 로직을 서버로 포팅)
export function isAnswerCorrect(quiz, answer) {
  if (!quiz) return false;
  if (quiz.type === 'SHORT') {
    const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
    const a = norm(answer);
    const correct = norm(quiz.answer);
    return (
      a === correct ||
      (quiz.answer === '디도스' && a === 'ddos') ||
      (quiz.answer === 'ASAP' && a === '아삽')
    );
  }
  return answer === quiz.answer;
}

// 다음 (살아있는) 턴 계산. allowEmpty=true 면 빈 팀도 건너뛰지 않음.
export function nextTurn(room) {
  return (room.currentTurn + 1) % room.teams.length;
}

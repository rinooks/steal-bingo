import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { customAlphabet } from 'nanoid';

import * as store from './store.mjs';
import { TEAM_CONFIG, MINI_GAMES, winThresholdFor } from './config.mjs';
import { buildBoard, checkBingo, isAnswerCorrect, nextTurn } from './gameEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = process.env.PORT || 3001;
const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---------------------- REST: 문제은행 (관리자) ----------------------
app.get('/api/questions', (req, res) => {
  const { category } = req.query;
  res.json(category ? store.getByCategory(category) : store.getAll());
});
app.get('/api/categories', (req, res) => res.json(store.getCategories()));
app.post('/api/questions', (req, res) => {
  if (Array.isArray(req.body)) return res.json(store.bulkAdd(req.body));
  res.json(store.addQuestion(req.body));
});
app.put('/api/questions/:id', (req, res) => {
  const updated = store.updateQuestion(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});
app.delete('/api/questions/:id', (req, res) => {
  res.json({ ok: store.deleteQuestion(req.params.id) });
});

// ---------------------- 정적 파일 (프로덕션 빌드) ----------------------
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ============================================================
//                        방(ROOM) 관리
// ============================================================
/** @type {Map<string, any>} */
const rooms = new Map();

function makeRoom(hostKey, mode, settings) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = {
    code,
    hostKey,
    mode, // 'team' | 'individual'
    status: 'lobby',
    settings: {
      boardSize: [4, 5, 7].includes(settings.boardSize) ? settings.boardSize : 5,
      claimMode: settings.claimMode === 'IMMEDIATE' ? 'IMMEDIATE' : 'QUIZ',
      maxSteals: [1, 3, 5, 10, 999].includes(settings.maxSteals) ? settings.maxSteals : 3,
      category: settings.category || 'HRD',
      teamCount: mode === 'team' ? Math.min(9, Math.max(2, settings.teamCount || 2)) : 0,
    },
    players: [], // { key, name, teamId, connected, socketId }
    // runtime (게임 시작 후 채워짐)
    boardSize: 5,
    claimMode: 'QUIZ',
    maxSteals: 3,
    teams: [],
    currentTurn: 0,
    board: [],
    completedLines: [],
    winningLines: [],
    winner: null,
    logs: [],
    active: null, // { kind:'quiz'|'steal', ... }
  };
  rooms.set(code, room);
  return room;
}

// 팀 모드에서 로비에 보여줄 팀 슬롯
function lobbyTeams(room) {
  if (room.mode !== 'team') return [];
  return TEAM_CONFIG.slice(0, room.settings.teamCount).map((t) => ({
    ...t,
    members: room.players.filter((p) => p.teamId === t.id).map((p) => p.name),
  }));
}

// 클라이언트로 보낼 공개 상태 (정답/문제 본문 절대 미포함)
function publicState(room) {
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    settings: room.settings,
    lobbyTeams: lobbyTeams(room),
    players: room.players.map((p) => ({ key: p.key, name: p.name, teamId: p.teamId, connected: p.connected })),
    boardSize: room.boardSize,
    claimMode: room.claimMode,
    maxSteals: room.maxSteals,
    teams: room.teams,
    currentTurn: room.currentTurn,
    winThreshold: winThresholdFor(room.boardSize),
    // 보드는 keyword/owner 만 (quiz 본문/정답 제거)
    board: room.board.map((c) => ({ index: c.index, keyword: c.keyword, owner: c.owner })),
    completedLines: room.completedLines,
    winningLines: room.winningLines,
    winner: room.winner,
    logs: room.logs,
    // active 는 메타만 (퀴즈 본문 제외) — 다른 조에는 "푸는 중"만 노출
    active: room.active
      ? {
          kind: room.active.kind,
          cellIndex: room.active.cellIndex,
          keyword: room.active.keyword,
          challengerTeamId: room.active.challengerTeamId,
          defenderTeamId: room.active.defenderTeamId ?? null,
          miniGame: room.active.miniGame ?? null,
        }
      : null,
  };
}

function socketsOfTeam(room, teamId) {
  return room.players.filter((p) => p.teamId === teamId && p.connected && p.socketId).map((p) => p.socketId);
}

function broadcastState(room) {
  io.to(room.code).emit('room:state', publicState(room));
}

// 현재 턴 팀에게만 풀어야 할 문제(정답 제외)를 비공개 전송
function sendPrivateQuiz(room) {
  if (!room.active || room.active.kind !== 'quiz') return;
  const q = room.active.quiz;
  const payload = {
    cellIndex: room.active.cellIndex,
    keyword: q.keyword,
    type: q.type,
    question: q.question,
    options: q.options || null,
  };
  for (const sid of socketsOfTeam(room, room.active.challengerTeamId)) {
    io.to(sid).emit('quiz:private', payload);
  }
}

function pushLog(room, line) {
  room.logs.push(line);
}

function startGame(room) {
  const { category, boardSize, claimMode, maxSteals } = room.settings;
  const pool = store.getByCategory(category);
  let board;
  try {
    board = buildBoard(pool, boardSize);
  } catch (e) {
    return { error: e.message };
  }

  let teams;
  if (room.mode === 'team') {
    teams = TEAM_CONFIG.slice(0, room.settings.teamCount).map((t) => ({
      ...t, bingoCount: 0, stealCount: 0,
    }));
  } else {
    // 개인전: 참가자 1인 = 1팀 (최대 9명)
    const players = room.players.slice(0, 9);
    teams = players.map((p, i) => ({
      ...TEAM_CONFIG[i], name: p.name, bingoCount: 0, stealCount: 0,
    }));
    players.forEach((p, i) => { p.teamId = i; });
    // 9명 초과 참가자는 관전 처리
    room.players.slice(9).forEach((p) => { p.teamId = null; });
  }

  Object.assign(room, {
    status: 'playing',
    boardSize, claimMode, maxSteals,
    teams,
    currentTurn: 0,
    board,
    completedLines: [],
    winningLines: [],
    winner: null,
    active: null,
    logs: [`게임 시작! (${room.mode === 'team' ? '조별전' : '개인전'}) 주제: ${category}`],
  });
  return { ok: true };
}

function advanceTurn(room) {
  room.currentTurn = nextTurn(room);
  room.active = null;
}

// ============================================================
//                        SOCKET.IO
// ============================================================
io.on('connection', (socket) => {
  // socket.data: { code, key, role }

  socket.on('host:create', ({ mode, settings, clientKey }, cb) => {
    const room = makeRoom(clientKey, mode === 'individual' ? 'individual' : 'team', settings || {});
    socket.join(room.code);
    socket.data = { code: room.code, key: clientKey, role: 'host' };
    cb?.({ ok: true, code: room.code, role: 'host' });
    broadcastState(room);
  });

  socket.on('room:join', ({ code, name, clientKey, teamId }, cb) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: '존재하지 않는 방 코드입니다.' });

    let player = room.players.find((p) => p.key === clientKey);
    if (player) {
      // 재접속
      player.connected = true;
      player.socketId = socket.id;
      if (name) player.name = name;
    } else {
      if (room.status !== 'lobby') {
        // 게임 시작 후엔 관전자로만 합류
        player = { key: clientKey, name: name || '게스트', teamId: null, connected: true, socketId: socket.id };
      } else if (room.mode === 'team') {
        const tid = Number.isInteger(teamId) ? teamId : 0;
        player = { key: clientKey, name: name || '게스트', teamId: Math.min(room.settings.teamCount - 1, Math.max(0, tid)), connected: true, socketId: socket.id };
      } else {
        player = { key: clientKey, name: name || '게스트', teamId: null, connected: true, socketId: socket.id };
      }
      room.players.push(player);
    }
    socket.join(room.code);
    socket.data = { code: room.code, key: clientKey, role: socket.data?.role === 'host' ? 'host' : 'player' };
    cb?.({ ok: true, role: socket.data.role, you: { key: player.key, name: player.name, teamId: player.teamId } });
    broadcastState(room);
    // 게임 진행 중 재접속이고 현재 턴 팀이면 진행중인 퀴즈 재전송
    if (room.active?.kind === 'quiz' && player.teamId === room.active.challengerTeamId) sendPrivateQuiz(room);
  });

  // 팀 모드 로비에서 팀 변경
  socket.on('player:setTeam', ({ teamId }, cb) => {
    const room = rooms.get(socket.data?.code);
    if (!room || room.mode !== 'team' || room.status !== 'lobby') return cb?.({ ok: false });
    const player = room.players.find((p) => p.key === socket.data.key);
    if (!player) return cb?.({ ok: false });
    player.teamId = Math.min(room.settings.teamCount - 1, Math.max(0, Number(teamId) || 0));
    cb?.({ ok: true, teamId: player.teamId });
    broadcastState(room);
  });

  const requireHost = () => {
    const room = rooms.get(socket.data?.code);
    if (!room || room.hostKey !== socket.data?.key) return null;
    return room;
  };

  socket.on('host:start', (_p, cb) => {
    const room = requireHost();
    if (!room) return cb?.({ ok: false, error: '권한이 없습니다.' });
    const r = startGame(room);
    if (r.error) return cb?.({ ok: false, error: r.error });
    cb?.({ ok: true });
    broadcastState(room);
  });

  socket.on('host:reset', (_p, cb) => {
    const room = requireHost();
    if (!room) return cb?.({ ok: false });
    room.status = 'lobby';
    room.board = []; room.teams = []; room.completedLines = []; room.winningLines = [];
    room.winner = null; room.active = null; room.logs = []; room.currentTurn = 0;
    cb?.({ ok: true });
    broadcastState(room);
  });

  socket.on('host:skipTurn', (_p, cb) => {
    const room = requireHost();
    if (!room || room.status !== 'playing') return cb?.({ ok: false });
    const t = room.teams.find((x) => x.id === room.currentTurn);
    pushLog(room, `⏭️ ${t?.name} 턴을 건너뜁니다.`);
    advanceTurn(room);
    cb?.({ ok: true });
    broadcastState(room);
  });

  // ---- 게임 액션 (현재 턴 팀의 플레이어만) ----
  function actingTeamId() {
    const room = rooms.get(socket.data?.code);
    if (!room || room.status !== 'playing') return { room: null };
    const player = room.players.find((p) => p.key === socket.data.key);
    if (!player || player.teamId === null || player.teamId === undefined) return { room, denied: true };
    if (player.teamId !== room.currentTurn) return { room, denied: true };
    return { room, teamId: player.teamId, player };
  }

  socket.on('game:selectCell', ({ cellIndex }, cb) => {
    const { room, teamId, denied } = actingTeamId();
    if (!room) return cb?.({ ok: false });
    if (denied) return cb?.({ ok: false, error: '당신의 턴이 아닙니다.' });
    if (room.active) return cb?.({ ok: false, error: '이미 진행 중인 액션이 있습니다.' });

    const cell = room.board[cellIndex];
    if (!cell) return cb?.({ ok: false });
    if (cell.owner === teamId) return cb?.({ ok: false, error: '이미 우리 팀 소유입니다.' });

    const team = room.teams.find((t) => t.id === teamId);

    if (cell.owner !== null) {
      // 스틸
      if (room.maxSteals !== 999 && team.stealCount >= room.maxSteals) {
        return cb?.({ ok: false, error: `스틸 횟수를 모두 소진했습니다! (${team.stealCount}/${room.maxSteals})` });
      }
      const miniGame = MINI_GAMES[Math.floor(Math.random() * MINI_GAMES.length)];
      room.active = { kind: 'steal', cellIndex, keyword: cell.keyword, challengerTeamId: teamId, defenderTeamId: cell.owner, miniGame };
      cb?.({ ok: true });
      broadcastState(room);
      return;
    }

    // 빈 칸
    if (room.claimMode === 'IMMEDIATE') {
      cell.owner = teamId;
      pushLog(room, `${team.name}가 ${cell.keyword} 점령`);
      const { newBingoFound } = checkBingo(room);
      advanceTurn(room);
      cb?.({ ok: true });
      if (newBingoFound) io.to(room.code).emit('fx:bingo');
      broadcastState(room);
    } else {
      room.active = { kind: 'quiz', cellIndex, keyword: cell.keyword, challengerTeamId: teamId, quiz: cell.quiz };
      cb?.({ ok: true });
      broadcastState(room);
      sendPrivateQuiz(room);
    }
  });

  socket.on('game:answer', ({ answer }, cb) => {
    const { room, teamId, denied } = actingTeamId();
    if (!room || !room.active || room.active.kind !== 'quiz') return cb?.({ ok: false });
    if (denied || teamId !== room.active.challengerTeamId) return cb?.({ ok: false, error: '권한이 없습니다.' });

    const quiz = room.active.quiz;
    const correct = isAnswerCorrect(quiz, answer);
    const cell = room.board[room.active.cellIndex];
    const team = room.teams.find((t) => t.id === teamId);

    // 결과(정답/해설)는 전체에 공개 (교육 효과)
    io.to(room.code).emit('quiz:result', {
      correct, byTeamId: teamId, keyword: quiz.keyword,
      answer: quiz.answer, explanation: quiz.explanation, submitted: answer,
    });

    if (correct) {
      cell.owner = teamId;
      pushLog(room, `🎯 ${team.name} 정답! ${cell.keyword} 점령`);
      const { newBingoFound } = checkBingo(room);
      advanceTurn(room);
      if (newBingoFound) io.to(room.code).emit('fx:bingo');
    } else {
      pushLog(room, `❌ ${team.name} 오답! 턴 종료`);
      advanceTurn(room);
    }
    cb?.({ ok: true, correct });
    broadcastState(room);
  });

  socket.on('game:resolveSteal', ({ challengerWon }, cb) => {
    const { room, teamId, denied } = actingTeamId();
    if (!room || !room.active || room.active.kind !== 'steal') return cb?.({ ok: false });
    if (denied || teamId !== room.active.challengerTeamId) return cb?.({ ok: false, error: '권한이 없습니다.' });

    const cell = room.board[room.active.cellIndex];
    const team = room.teams.find((t) => t.id === teamId);
    team.stealCount += 1; // 시도 시 차감

    if (challengerWon) {
      cell.owner = teamId;
      pushLog(room, `⚔️ ${team.name} 스틸 성공!`);
      const { newBingoFound } = checkBingo(room);
      advanceTurn(room);
      if (newBingoFound) io.to(room.code).emit('fx:bingo');
    } else {
      pushLog(room, `🛡️ 방어 성공! 턴 종료`);
      advanceTurn(room);
    }
    cb?.({ ok: true });
    broadcastState(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data?.code);
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (player) { player.connected = false; player.socketId = null; }
    broadcastState(room);
  });
});

// 빈 방 정리 (1시간 무활동) — 간단 주기 정리
setInterval(() => {
  for (const [code, room] of rooms) {
    const anyone = room.players.some((p) => p.connected);
    if (!anyone) {
      room._emptySince = room._emptySince || Date.now();
      if (Date.now() - room._emptySince > 60 * 60 * 1000) rooms.delete(code);
    } else {
      room._emptySince = null;
    }
  }
}, 5 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 STEAL BINGO 서버 실행 중  →  http://localhost:${PORT}`);
  console.log(`   (같은 와이파이의 다른 기기는 http://<이 PC의 IP>:${PORT} 로 접속)\n`);
});

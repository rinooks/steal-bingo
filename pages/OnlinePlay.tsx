import React, { useEffect, useRef, useState } from 'react';
import { RoomState, PrivateQuiz, QuizResult, GameMode } from '../types';
import { getSocket, emitAck, getClientKey, QuizAPI, CategoryDTO } from '../lib/socket';
import ConfirmModal from '../components/ConfirmModal';
import OnlineQuizModal from '../components/OnlineQuizModal';
import Footer from '../components/Footer';

type Me = { role: 'host' | 'player' | null; key: string; name: string; teamId: number | null };
type Screen = 'entry' | 'create' | 'join';

const OnlinePlay: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [screen, setScreen] = useState<Screen>('entry');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<Me>({ role: null, key: getClientKey(), name: '', teamId: null });
  const [privateQuiz, setPrivateQuiz] = useState<PrivateQuiz | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [bingoFx, setBingoFx] = useState(false);
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const [pendingCell, setPendingCell] = useState<{ index: number; keyword: string; isSteal: boolean } | null>(null);

  const meRef = useRef(me);
  meRef.current = me;

  // --- socket lifecycle ---
  useEffect(() => {
    const s = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState = (state: RoomState) => {
      setRoom(state);
      // 내 teamId 갱신 (개인전은 시작 시 서버가 재배정)
      const meKey = meRef.current.key;
      const p = state.players.find((x) => x.key === meKey);
      if (p) setMe((prev) => ({ ...prev, teamId: p.teamId, name: prev.name || p.name }));
      // 새 액션이 시작되면 이전 결과 오버레이 제거
      if (state.active) setResult(null);
      // 내 퀴즈가 아니게 되면 닫기
      if (!state.active || state.active.kind !== 'quiz') setPrivateQuiz(null);
    };
    const onPrivateQuiz = (q: PrivateQuiz) => setPrivateQuiz(q);
    const onResult = (r: QuizResult) => { setResult(r); setPrivateQuiz(null); };
    const onBingo = () => { setBingoFx(true); setTimeout(() => setBingoFx(false), 2000); };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('room:state', onState);
    s.on('quiz:private', onPrivateQuiz);
    s.on('quiz:result', onResult);
    s.on('fx:bingo', onBingo);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('room:state', onState);
      s.off('quiz:private', onPrivateQuiz);
      s.off('quiz:result', onResult);
      s.off('fx:bingo', onBingo);
    };
  }, []);

  // ============ ENTRY / CREATE / JOIN ============
  if (!room) {
    return (
      <Lobbyless
        screen={screen}
        setScreen={setScreen}
        me={me}
        setMe={setMe}
        connected={connected}
        notice={notice}
        setNotice={setNotice}
        onCreated={(role) => setMe((prev) => ({ ...prev, role }))}
        navigate={navigate}
      />
    );
  }

  // ============ IN ROOM ============
  const isHost = me.role === 'host';
  const myTeam = room.teams.find((t) => t.id === me.teamId);
  const isMyTurn = room.status === 'playing' && me.teamId !== null && me.teamId === room.currentTurn;
  const currentTeam = room.teams.find((t) => t.id === room.currentTurn);

  const leaveRoom = () => { setRoom(null); setScreen('entry'); setMe((p) => ({ ...p, role: null, teamId: null })); };

  // ----- LOBBY -----
  if (room.status === 'lobby') {
    return (
      <LobbyView
        room={room} me={me} isHost={isHost}
        onSetTeam={(tid) => emitAck('player:setTeam', { teamId: tid })}
        onStart={async () => {
          const r: any = await emitAck('host:start', {});
          if (!r?.ok) setNotice(r?.error || '시작할 수 없습니다.');
        }}
        onLeave={leaveRoom}
        notice={notice}
      />
    );
  }

  // ----- GAME / GAMEOVER -----
  const onCellClick = (index: number) => {
    if (!isMyTurn || room.active) return;
    const cell = room.board[index];
    if (cell.owner === me.teamId) return;
    if (cell.owner !== null && myTeam && room.maxSteals !== 999 && myTeam.stealCount >= room.maxSteals) {
      setNotice(`스틸 횟수를 모두 소진했습니다! (${myTeam.stealCount}/${room.maxSteals})`);
      return;
    }
    setPendingCell({ index, keyword: cell.keyword, isSteal: cell.owner !== null });
  };

  const confirmCell = async () => {
    if (!pendingCell) return;
    const idx = pendingCell.index;
    setPendingCell(null);
    const r: any = await emitAck('game:selectCell', { cellIndex: idx });
    if (!r?.ok) setNotice(r.error || '선택할 수 없습니다.');
  };

  return (
    <GameView
      room={room} me={me} isHost={isHost} isMyTurn={isMyTurn}
      currentTeamName={currentTeam?.name || ''}
      onCellClick={onCellClick}
      bingoFx={bingoFx}
      onSkip={() => emitAck('host:skipTurn', {})}
      onReset={() => emitAck('host:reset', {})}
      onLeave={leaveRoom}
      notice={notice}
      setNotice={setNotice}
    >
      {/* 비공개 퀴즈 (현재 턴 팀만) */}
      {privateQuiz && room.active?.kind === 'quiz' && isMyTurn && (
        <OnlineQuizModal
          quiz={privateQuiz}
          teamName={myTeam?.name || ''}
          onSubmit={(ans) => emitAck('game:answer', { answer: ans })}
        />
      )}

      {/* 다른 조/호스트: 푸는 중 표시 */}
      {room.active?.kind === 'quiz' && !(isMyTurn && privateQuiz) && (
        <LockedOverlay
          title={`${currentTeamName(room)}이(가) 문제 푸는 중`}
          keyword={room.active.keyword}
        />
      )}

      {/* 스틸 배틀 */}
      {room.active?.kind === 'steal' && (
        <StealPanel
          room={room}
          canResolve={isMyTurn}
          onResolve={(win) => emitAck('game:resolveSteal', { challengerWon: win })}
        />
      )}

      {/* 결과 공개 (전체) */}
      {result && !room.active && (
        <ResultOverlay result={result} teamName={room.teams.find((t) => t.id === result.byTeamId)?.name || ''} onClose={() => setResult(null)} />
      )}
    </GameView>
  );
};

function currentTeamName(room: RoomState) {
  return room.teams.find((t) => t.id === room.active?.challengerTeamId)?.name || '상대 팀';
}

// ==================================================================
//  입장 화면 (방 만들기 / 참가)
// ==================================================================
const Lobbyless: React.FC<any> = ({ screen, setScreen, me, setMe, connected, notice, setNotice, onCreated, navigate }) => {
  const [mode, setMode] = useState<GameMode>('team');
  const [boardSize, setBoardSize] = useState<4 | 5 | 7>(5);
  const [teamCount, setTeamCount] = useState(2);
  const [claimMode, setClaimMode] = useState<'QUIZ' | 'IMMEDIATE'>('QUIZ');
  const [maxSteals, setMaxSteals] = useState(3);
  const [category, setCategory] = useState('HRD');
  const [cats, setCats] = useState<CategoryDTO[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joinTeam, setJoinTeam] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { QuizAPI.categories().then(setCats).catch(() => setNotice('서버 연결 실패: 서버를 실행했는지 확인하세요.')); }, []);

  const catObj = cats.find((c) => c.id === category);
  const needCount = boardSize * boardSize;
  const enoughQ = !catObj || catObj.count >= needCount;

  const createRoom = async () => {
    setBusy(true);
    const r: any = await emitAck('host:create', { mode, clientKey: me.key, settings: { boardSize, teamCount, claimMode, maxSteals, category } });
    setBusy(false);
    if (r?.ok) onCreated('host');
    else setNotice(r?.error || '방 생성 실패');
  };

  const joinRoom = async () => {
    if (!me.name.trim()) return setNotice('이름을 입력하세요.');
    if (!joinCode.trim()) return setNotice('방 코드를 입력하세요.');
    setBusy(true);
    const r: any = await emitAck('room:join', { code: joinCode.trim().toUpperCase(), name: me.name.trim(), clientKey: me.key, teamId: joinTeam });
    setBusy(false);
    if (r?.ok) setMe((p: Me) => ({ ...p, role: 'player', teamId: r.you?.teamId ?? null }));
    else setNotice(r?.error || '입장 실패');
  };

  const box = 'bg-white border-4 border-black p-6 shadow-neo';
  const seg = (on: boolean) => `py-2 px-3 border-4 border-black font-black text-sm ${on ? 'bg-black text-white' : 'bg-white text-gray-400'}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-black tracking-tighter">🌐 온라인 멀티</h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black px-2 py-1 border-2 border-black ${connected ? 'bg-[#00E676]' : 'bg-[#FF1744] text-white'}`}>
              {connected ? '● 연결됨' : '○ 연결중'}
            </span>
            <button onClick={() => navigate('/')} className="bg-black text-white border-2 border-black px-3 py-1 font-black text-sm">← 메뉴</button>
          </div>
        </div>

        {notice && <div className="bg-[#FF1744] text-white border-4 border-black p-3 font-bold mb-4">{notice}</div>}

        {screen === 'entry' && (
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setScreen('create')} className={`${box} text-left hover:translate-y-1 hover:shadow-neo-hover transition-all`}>
              <div className="text-4xl mb-2">👑</div>
              <h3 className="text-xl font-black">방 만들기</h3>
              <p className="text-xs font-bold text-gray-500 mt-1">호스트(진행자/프로젝터)</p>
            </button>
            <button onClick={() => setScreen('join')} className={`${box} text-left hover:translate-y-1 hover:shadow-neo-hover transition-all`}>
              <div className="text-4xl mb-2">🙋</div>
              <h3 className="text-xl font-black">방 참가</h3>
              <p className="text-xs font-bold text-gray-500 mt-1">참가자(플레이어)</p>
            </button>
          </div>
        )}

        {screen === 'create' && (
          <div className={box}>
            <div className="space-y-5">
              <div>
                <label className="block font-black mb-2 border-b-2 border-black pb-1">경쟁 모드</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMode('team')} className={seg(mode === 'team')}>조별 경쟁</button>
                  <button onClick={() => setMode('individual')} className={seg(mode === 'individual')}>개인 경쟁</button>
                </div>
              </div>

              <div>
                <label className="block font-black mb-2 border-b-2 border-black pb-1">주제 (카테고리)</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 border-4 border-black font-bold">
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.count}문제)</option>)}
                </select>
                {!enoughQ && <p className="text-[#FF1744] font-bold text-xs mt-1">⚠ 문제 수 부족: {needCount}개 필요, 현재 {catObj?.count}개</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-black mb-2 border-b-2 border-black pb-1">보드</label>
                  <div className="flex gap-1">
                    {[4, 5, 7].map((s) => <button key={s} onClick={() => setBoardSize(s as any)} className={`flex-1 ${seg(boardSize === s)}`}>{s}×{s}</button>)}
                  </div>
                </div>
                {mode === 'team' && (
                  <div>
                    <label className="block font-black mb-2 border-b-2 border-black pb-1">팀 수</label>
                    <select value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} className="w-full p-3 border-4 border-black font-bold">
                      {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}팀</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-black mb-2 border-b-2 border-black pb-1">선점 방식</label>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setClaimMode('QUIZ')} className={seg(claimMode === 'QUIZ')}>퀴즈로 점령</button>
                    <button onClick={() => setClaimMode('IMMEDIATE')} className={seg(claimMode === 'IMMEDIATE')}>즉시 점령</button>
                  </div>
                </div>
                <div>
                  <label className="block font-black mb-2 border-b-2 border-black pb-1">스틸 제한</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 3, 5, 10, 999].map((l) => <button key={l} onClick={() => setMaxSteals(l)} className={seg(maxSteals === l)}>{l === 999 ? '∞' : l}</button>)}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setScreen('entry')} className="px-5 py-4 bg-white border-4 border-black font-black">뒤로</button>
                <button disabled={!enoughQ || busy} onClick={createRoom} className="flex-1 py-4 bg-[#00E676] border-4 border-black font-black text-xl shadow-neo-sm active:translate-y-1 active:shadow-none disabled:opacity-40">
                  방 만들기
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === 'join' && (
          <div className={box}>
            <div className="space-y-5">
              <div>
                <label className="block font-black mb-2 border-b-2 border-black pb-1">내 이름 / 닉네임</label>
                <input value={me.name} onChange={(e) => setMe((p: Me) => ({ ...p, name: e.target.value }))} placeholder="예: 홍길동" className="w-full p-3 border-4 border-black font-bold text-lg" />
              </div>
              <div>
                <label className="block font-black mb-2 border-b-2 border-black pb-1">방 코드</label>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="예: AB3K" maxLength={4} className="w-full p-3 border-4 border-black font-black text-3xl tracking-[0.3em] text-center uppercase" />
              </div>
              <p className="text-xs font-bold text-gray-500">조 선택은 입장 후 로비에서 할 수 있어요 (조별전).</p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setScreen('entry')} className="px-5 py-4 bg-white border-4 border-black font-black">뒤로</button>
                <button disabled={busy} onClick={joinRoom} className="flex-1 py-4 bg-[#00E5FF] border-4 border-black font-black text-xl shadow-neo-sm active:translate-y-1 active:shadow-none disabled:opacity-40">입장하기</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

// ==================================================================
//  로비 (대기실)
// ==================================================================
const LobbyView: React.FC<any> = ({ room, me, isHost, onSetTeam, onStart, onLeave, notice }) => {
  const r: RoomState = room;
  const joinUrl = location.origin; // 참가자가 접속할 현재 앱 주소
  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-black tracking-tighter">대기실</h1>
          <button onClick={onLeave} className="bg-black text-white border-2 border-black px-3 py-1 font-black text-sm">나가기</button>
        </div>

        <div className="bg-black text-white border-4 border-black p-5 mb-4 text-center shadow-neo">
          <p className="text-xs font-bold opacity-70">방 코드 (참가자에게 알려주세요)</p>
          <p className="text-6xl font-black tracking-[0.2em] my-2">{r.code}</p>
          <p className="text-xs font-mono opacity-70 break-all">접속: {joinUrl} → 온라인 멀티 → 방 참가</p>
          <p className="text-xs font-bold mt-2">{r.mode === 'team' ? `조별전 · ${r.settings.teamCount}팀` : '개인전'} · {r.settings.boardSize}×{r.settings.boardSize} · 주제 {r.settings.category}</p>
        </div>

        {notice && <div className="bg-[#FF1744] text-white border-4 border-black p-3 font-bold mb-4">{notice}</div>}

        {/* 팀 모드: 팀 슬롯 */}
        {r.mode === 'team' ? (
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {r.lobbyTeams.map((t) => (
              <div key={t.id} className={`border-4 border-black p-3 ${t.color} ${t.textColor}`}>
                <div className="flex items-center justify-between">
                  <span className="font-black text-lg">{t.name}</span>
                  {!isHost && (
                    <button onClick={() => onSetTeam(t.id)} className={`text-xs font-black px-2 py-1 border-2 border-black ${me.teamId === t.id ? 'bg-white text-black' : 'bg-black text-white'}`}>
                      {me.teamId === t.id ? '내 팀 ✓' : '이 팀 선택'}
                    </button>
                  )}
                </div>
                <div className="mt-2 text-sm font-bold min-h-[1.5rem]">
                  {t.members.length ? t.members.join(', ') : <span className="opacity-60">아직 없음</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border-4 border-black p-4 mb-4">
            <h3 className="font-black mb-2">참가자 ({r.players.filter((p) => p.connected).length})</h3>
            <div className="flex flex-wrap gap-2">
              {r.players.filter((p) => p.connected).map((p) => (
                <span key={p.key} className="bg-gray-100 border-2 border-black px-3 py-1 font-bold text-sm">{p.name}{p.key === me.key ? ' (나)' : ''}</span>
              ))}
              {r.players.filter((p) => p.connected).length === 0 && <span className="text-gray-400 font-bold italic">참가자를 기다리는 중...</span>}
            </div>
            <p className="text-xs text-gray-500 font-bold mt-2">개인전은 입장 순서대로 최대 9명까지 자동 배정됩니다.</p>
          </div>
        )}

        {isHost ? (
          <button onClick={onStart} className="w-full py-5 bg-[#00E676] border-4 border-black font-black text-2xl shadow-neo active:translate-y-1 active:shadow-none">
            게임 시작 🚀
          </button>
        ) : (
          <div className="text-center font-black text-lg bg-white border-4 border-black p-4">호스트가 게임을 시작하길 기다리는 중...</div>
        )}
      </div>
      <Footer />
    </div>
  );
};

// ==================================================================
//  게임 화면 (보드 + 점수 + 로그)
// ==================================================================
const getLineCoordinates = (startIndex: number, endIndex: number, size: number) => {
  const sr = Math.floor(startIndex / size), sc = startIndex % size;
  const er = Math.floor(endIndex / size), ec = endIndex % size;
  const w = 100 / size;
  return { x1: `${sc * w + w / 2}%`, y1: `${sr * w + w / 2}%`, x2: `${ec * w + w / 2}%`, y2: `${er * w + w / 2}%` };
};

const GameView: React.FC<any> = ({ room, me, isHost, isMyTurn, currentTeamName, onCellClick, bingoFx, onSkip, onReset, onLeave, notice, setNotice, children }) => {
  const r: RoomState = room;
  const currentTeam = r.teams.find((t) => t.id === r.currentTurn);
  const myTeam = r.teams.find((t) => t.id === me.teamId);

  useEffect(() => { if (notice) { const id = setTimeout(() => setNotice(''), 2500); return () => clearTimeout(id); } }, [notice]);

  return (
    <div className="min-h-screen flex flex-col items-center pb-20 relative overflow-hidden">
      <header className="w-full max-w-[1600px] p-4 flex justify-between items-center z-10 gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter">STEAL BINGO <span className="text-xs align-top bg-black text-white px-1">{r.code}</span></h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs bg-black text-white px-2 py-0.5 font-bold border-2 border-black">{r.mode === 'team' ? '조별전' : '개인전'} · {r.settings.category} ({r.boardSize}×{r.boardSize})</span>
            {isHost && <span className="text-xs bg-[#FFD700] px-2 py-0.5 font-bold border-2 border-black">👑 호스트(프로젝터)</span>}
            {!isHost && myTeam && <span className={`text-xs px-2 py-0.5 font-bold border-2 border-black ${myTeam.color} ${myTeam.textColor}`}>내 팀: {myTeam.name}</span>}
            {!isHost && me.teamId === null && <span className="text-xs bg-gray-200 px-2 py-0.5 font-bold border-2 border-black">관전</span>}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] text-black font-black font-mono mb-1 bg-white px-1">CURRENT TURN</span>
          <div className={`px-4 py-2 border-4 border-black font-black text-lg shadow-neo flex flex-col items-end ${currentTeam?.color} ${currentTeam?.textColor}`}>
            <span>{currentTeam?.name}{isMyTurn && ' (나)'}</span>
            <span className="text-[10px] font-mono opacity-80">STEALS {currentTeam?.stealCount}/{r.maxSteals === 999 ? '∞' : r.maxSteals}</span>
          </div>
        </div>
      </header>

      {isMyTurn && !r.active && (
        <div className="bg-[#00E676] border-4 border-black px-6 py-2 font-black text-lg mb-2 animate-bounce shadow-neo-sm">🎯 당신 차례입니다! 칸을 선택하세요</div>
      )}

      <div className="flex-1 w-full max-w-[1600px] p-4 flex flex-col md:flex-row items-center md:items-start justify-center gap-6 relative z-10">
        {/* Teams */}
        <div className="w-full md:w-64 flex flex-col gap-3 order-2 md:order-1 shrink-0 md:h-[650px]">
          <h3 className="hidden md:block font-black text-lg uppercase border-b-4 border-black pb-2">{r.mode === 'team' ? 'Teams' : 'Players'}</h3>
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
              {r.teams.map((team) => (
                <div key={team.id} className={`border-4 border-black p-2 ${team.id === r.currentTurn ? `${team.color} shadow-neo-sm` : 'bg-white opacity-60'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-black ${team.id === r.currentTurn ? team.textColor : 'text-black'}`}>{team.name}</span>
                    {team.id === me.teamId && <span className="text-[10px] font-black bg-black text-white px-1">나</span>}
                  </div>
                  <div className="flex justify-between items-end mt-1">
                    <span className={`font-black text-3xl leading-none ${team.id === r.currentTurn ? team.textColor : 'text-black'}`}>{team.bingoCount}<span className="text-xs ml-1">L</span></span>
                    <span className={`text-[10px] font-bold ${team.id === r.currentTurn ? team.textColor : 'text-black'}`}>⚔️{team.stealCount}/{r.maxSteals === 999 ? '∞' : r.maxSteals}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] font-bold text-gray-500">목표: {r.winThreshold}줄</div>
        </div>

        {/* Board */}
        <div className="flex-1 flex justify-center items-start order-1 md:order-2 w-full">
          <div className="relative bg-black border-4 border-black p-1 shadow-neo" style={{ width: '100%', maxWidth: '650px', aspectRatio: '1/1' }}>
            <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible">
              {r.winningLines.map((line) => {
                const c = getLineCoordinates(line.startIndex, line.endIndex, r.boardSize);
                return <line key={line.id} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#FF0000" strokeWidth="10" strokeLinecap="square" className="draw-line opacity-90 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]" />;
              })}
            </svg>
            <div className="grid w-full h-full gap-1" style={{ gridTemplateColumns: `repeat(${r.boardSize}, minmax(0,1fr))`, gridTemplateRows: `repeat(${r.boardSize}, minmax(0,1fr))` }}>
              {r.board.map((cell) => {
                const owner = cell.owner !== null ? r.teams.find((t) => t.id === cell.owner) : null;
                const clickable = isMyTurn && !r.active && cell.owner !== me.teamId;
                return (
                  <div key={cell.index} onClick={() => clickable && onCellClick(cell.index)}
                    className={`relative border-0 flex items-center justify-center p-1 text-center select-none transition-all overflow-hidden group
                      ${owner ? `${owner.color} ${owner.textColor}` : 'bg-white text-black'}
                      ${clickable ? 'cursor-pointer hover:ring-4 hover:ring-[#FF0000] hover:z-10' : 'cursor-default'}`}>
                    <div className={`absolute top-0 left-0 text-[10px] md:text-xs font-bold px-1.5 py-0.5 border-r-2 border-b-2 border-black z-10 ${owner ? 'bg-white text-black' : 'bg-black text-white'}`}>{cell.index + 1}</div>
                    <span className={`font-black leading-snug break-keep z-0 px-1 w-full flex items-center justify-center h-full ${r.boardSize === 7 ? 'text-xs md:text-base' : 'text-sm md:text-2xl'}`}>{cell.keyword}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Logs + host controls */}
        <div className="w-full md:w-72 shrink-0 flex flex-col order-3 md:h-[650px] gap-3">
          {isHost && (
            <div className="bg-white border-4 border-black p-3 shadow-neo-sm flex gap-2">
              <button onClick={onSkip} className="flex-1 py-2 bg-[#FFD700] border-2 border-black font-black text-sm">⏭️ 턴넘기기</button>
              <button onClick={onReset} className="flex-1 py-2 bg-white border-2 border-black font-black text-sm hover:bg-[#FF1744] hover:text-white">🔄 새 게임</button>
            </div>
          )}
          <h3 className="hidden md:block font-black text-lg uppercase border-b-4 border-black pb-2">System Log</h3>
          <div className="w-full flex-1 h-48 md:h-auto bg-white border-4 border-black p-3 font-mono text-sm overflow-y-auto shadow-neo">
            <div className="flex flex-col gap-2">
              {r.logs.slice().reverse().map((log, i) => (
                <div key={i} className="pb-2 border-b-2 border-gray-100 last:border-0"><span className="text-[#FF0000] mr-2 font-black">➜</span><span className="font-bold break-words">{log}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {bingoFx && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <h1 className="text-[8rem] font-black text-[#FF0000] tracking-tighter drop-shadow-[10px_10px_0px_#000] bingo-burst text-stroke">BINGO!</h1>
        </div>
      )}

      {notice && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#FF1744] text-white border-4 border-black px-5 py-2 font-black z-[120] shadow-neo-sm">{notice}</div>}

      {r.status === 'gameover' && r.winner !== null && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-8 text-center max-w-md w-full shadow-[20px_20px_0px_0px_#FFD700]">
            <h2 className="text-5xl font-black mb-4">WINNER!</h2>
            <div className={`text-3xl font-bold mb-8 p-4 border-4 border-black inline-block shadow-neo ${r.teams.find((t) => t.id === r.winner)?.color} ${r.teams.find((t) => t.id === r.winner)?.textColor}`}>
              {r.teams.find((t) => t.id === r.winner)?.name}
            </div>
            {isHost ? (
              <button onClick={onReset} className="block w-full bg-black text-white font-bold py-4 text-xl border-4 border-black shadow-neo active:translate-y-1 active:shadow-none">새 게임 (대기실로)</button>
            ) : (
              <button onClick={onLeave} className="block w-full bg-black text-white font-bold py-4 text-xl border-4 border-black shadow-neo active:translate-y-1 active:shadow-none">나가기</button>
            )}
          </div>
        </div>
      )}

      {children}
      <Footer />
    </div>
  );
};

// 잠금 오버레이 (다른 조가 문제 푸는 중)
const LockedOverlay: React.FC<{ title: string; keyword: string }> = ({ title, keyword }) => (
  <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white border-4 border-black p-10 text-center max-w-sm shadow-[16px_16px_0_0_#000]">
      <div className="text-6xl mb-4">🔒</div>
      <h2 className="text-2xl font-black break-keep">{title}</h2>
      <p className="mt-3 font-bold text-gray-500">KEYWORD</p>
      <p className="text-xl font-black bg-black text-white inline-block px-4 py-1 mt-1">{keyword}</p>
      <p className="mt-4 text-sm font-bold text-gray-400">문제 내용은 푸는 팀에게만 표시됩니다</p>
      <div className="mt-4 flex justify-center gap-1">
        <span className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-black animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

// 스틸 배틀 패널
const StealPanel: React.FC<{ room: RoomState; canResolve: boolean; onResolve: (win: boolean) => void }> = ({ room, canResolve, onResolve }) => {
  const a = room.active!;
  const ch = room.teams.find((t) => t.id === a.challengerTeamId);
  const df = room.teams.find((t) => t.id === a.defenderTeamId!);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border-4 border-black w-full max-w-lg shadow-[15px_15px_0_0_#000]">
        <div className="bg-black p-4 text-center border-b-4 border-black">
          <h2 className="text-2xl font-black text-white tracking-tighter animate-pulse">⚔️ STEAL BATTLE</h2>
          <p className="text-white mt-1 text-sm font-bold flex items-center justify-center gap-2">
            <span className={ch?.color.replace('bg-', 'text-')}>{ch?.name}</span>
            <span className="text-white/60">vs</span>
            <span className={df?.color.replace('bg-', 'text-')}>{df?.name}</span>
          </p>
        </div>
        <div className="p-8 text-center">
          <p className="text-sm font-bold text-gray-500 mb-2">BATTLE MISSION</p>
          <div className="text-2xl font-black border-4 border-black p-6 bg-yellow-50">{a.miniGame?.title}</div>
          <p className="mt-2 text-sm font-bold text-gray-600 bg-gray-100 p-2 inline-block border-2 border-gray-300">{a.miniGame?.description}</p>

          {canResolve ? (
            <div className="mt-6">
              <p className="font-bold mb-3 animate-bounce">미니게임 결과를 선택하세요!</p>
              <div className="flex gap-3">
                <button onClick={() => onResolve(true)} className={`flex-1 py-4 ${ch?.color} ${ch?.textColor} border-4 border-black font-black shadow-neo-sm active:translate-y-1 active:shadow-none`}>
                  {ch?.name} 승리<div className="text-xs opacity-80">(스틸 성공)</div>
                </button>
                <button onClick={() => onResolve(false)} className={`flex-1 py-4 ${df?.color} ${df?.textColor} border-4 border-black font-black shadow-neo-sm active:translate-y-1 active:shadow-none`}>
                  {df?.name} 승리<div className="text-xs opacity-80">(방어 성공)</div>
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-6 font-black text-gray-500">{ch?.name}이(가) 결과를 입력하는 중...</p>
          )}
        </div>
      </div>
    </div>
  );
};

// 결과 공개 오버레이 (전체)
const ResultOverlay: React.FC<{ result: QuizResult; teamName: string; onClose: () => void }> = ({ result, teamName, onClose }) => (
  <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
    <div className="bg-white border-4 border-black w-full max-w-md shadow-[16px_16px_0_0_#000]" onClick={(e) => e.stopPropagation()}>
      <div className={`p-6 text-center border-b-4 border-black ${result.correct ? 'bg-team-4' : 'bg-team-1'}`}>
        <h3 className="text-5xl font-black text-white italic" style={{ WebkitTextStroke: '2px black', textShadow: '5px 5px 0 #000' }}>{result.correct ? 'SUCCESS!' : 'FAILED!'}</h3>
        <p className="text-white font-black mt-2">{teamName} · {result.keyword}</p>
      </div>
      <div className="p-6">
        <p className="text-xs text-gray-500 font-black uppercase">정답 및 해설</p>
        <p className="text-2xl font-black text-team-1 my-2">정답: {result.answer}</p>
        {result.explanation && <p className="font-bold leading-relaxed">{result.explanation}</p>}
        <button onClick={onClose} className="mt-5 w-full py-3 bg-black text-white font-black text-lg border-4 border-black active:translate-y-1">확인</button>
      </div>
    </div>
  </div>
);

export default OnlinePlay;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, TeamId, BingoCell, BingoLine, QuizCategory, ClaimMode } from '../types';
import { GET_QUIZ_DATA, TEAM_CONFIG, CATEGORY_CONFIG, GET_ALL_QUIZ_DATA } from '../constants';
import Footer from '../components/Footer';
import QuizModal from '../components/QuizModal';
import ConfirmModal from '../components/ConfirmModal';
import StealModal from '../components/StealModal';
import TutorialModal from '../components/TutorialModal';

// --- Icons ---
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3"/><path d="M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
);

const LocalGame: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  // --- STATE ---
  const [gameState, setGameState] = useState<GameState>({
    status: 'setup',
    boardSize: 5,
    teamCount: 2,
    selectedCategory: 'HRD', // Default
    claimMode: 'QUIZ', // Default
    maxSteals: 3, // Default
    teams: [],
    currentTurn: 0,
    board: [],
    completedLines: [],
    winningLines: [],
    winner: null,
    logs: []
  });

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    index: number;
    keyword: string;
    isSteal: boolean;
  }>({
    isOpen: false,
    index: -1,
    keyword: '',
    isSteal: false
  });

  const [quizModal, setQuizModal] = useState<{
    isOpen: boolean;
    quiz: any;
    targetCellIndex: number;
    challenger: TeamId;
  }>({
    isOpen: false,
    quiz: null,
    targetCellIndex: -1,
    challenger: 0
  });

  const [stealModal, setStealModal] = useState<{
    isOpen: boolean;
    targetCellIndex: number;
    challenger: TeamId;
    defender: TeamId;
  }>({
    isOpen: false,
    targetCellIndex: -1,
    challenger: 0,
    defender: 0
  });

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [showBingoBurst, setShowBingoBurst] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- LOGIC: Setup ---
  const initializeGame = (
    size: 4 | 5 | 7,
    teams: number,
    category: QuizCategory,
    claimMode: ClaimMode,
    maxSteals: number
  ) => {
    // Load Data based on Category
    const categoryData = GET_QUIZ_DATA(category);

    // Validate Data Count
    if (categoryData.length < size * size) {
      alert(`선택한 카테고리의 문제 수(${categoryData.length})가 보드 크기(${size * size})보다 부족합니다.`);
      return;
    }

    // Shuffle Data
    const shuffledData = [...categoryData].sort(() => Math.random() - 0.5);
    const selectedData = shuffledData.slice(0, size * size);

    const initialBoard: BingoCell[] = selectedData.map((quiz, idx) => ({
      index: idx,
      keyword: quiz.keyword,
      quiz: quiz,
      owner: null,
      isLocked: false
    }));

    const initialTeams = TEAM_CONFIG.slice(0, teams).map(t => ({
      ...t,
      id: t.id as TeamId,
      bingoCount: 0,
      stealCount: 0
    }));

    setGameState({
      status: 'playing',
      boardSize: size,
      teamCount: teams,
      selectedCategory: category,
      claimMode: claimMode,
      maxSteals: maxSteals,
      teams: initialTeams,
      currentTurn: 0,
      board: initialBoard,
      completedLines: [],
      winningLines: [],
      winner: null,
      logs: [`게임 시작! 주제: ${CATEGORY_CONFIG.find(c => c.id === category)?.label}`]
    });
  };

  // --- LOGIC: Check Bingo (Enhanced for Steal/Break) ---
  const checkBingo = useCallback((currentBoard: BingoCell[], currentTeams?: typeof gameState.teams) => {
    const size = gameState.boardSize;

    // 1. 모든 가능한 라인 패턴 정의
    const linePatterns: { id: string, indices: number[] }[] = [];

    // Rows
    for (let r = 0; r < size; r++) {
      const rowIndices = [];
      for (let c = 0; c < size; c++) rowIndices.push(r * size + c);
      linePatterns.push({ id: `row-${r}`, indices: rowIndices });
    }
    // Cols
    for (let c = 0; c < size; c++) {
      const colIndices = [];
      for (let r = 0; r < size; r++) colIndices.push(r * size + c);
      linePatterns.push({ id: `col-${c}`, indices: colIndices });
    }
    // Diagonals
    const diag1 = [];
    const diag2 = [];
    for (let i = 0; i < size; i++) {
      diag1.push(i * size + i);
      diag2.push(i * size + (size - 1 - i));
    }
    linePatterns.push({ id: 'diag-1', indices: diag1 });
    linePatterns.push({ id: 'diag-2', indices: diag2 });

    // 상태 복제 (전달된 팀 정보가 있으면 그것을 사용, 없으면 현재 상태 사용)
    let updatedTeams = currentTeams ? [...currentTeams] : [...gameState.teams];
    let updatedCompletedLines = [...gameState.completedLines];
    let updatedWinningLines = [...gameState.winningLines];
    const newLogs: string[] = [];
    let newBingoFound = false;

    // 2. [파괴 로직] 기존 완성된 라인이 여전히 유효한지 검사
    const brokenLines: string[] = [];

    updatedCompletedLines.forEach(lineUniqueId => {
      const [teamIdStr, ...lineIdParts] = lineUniqueId.split('-');
      const teamId = parseInt(teamIdStr) as TeamId;
      const lineId = lineIdParts.join('-');

      const pattern = linePatterns.find(p => p.id === lineId);
      if (pattern) {
        const stillOwns = pattern.indices.every(idx => currentBoard[idx].owner === teamId);

        if (!stillOwns) {
          brokenLines.push(lineUniqueId);
          const teamIndex = updatedTeams.findIndex(t => t.id === teamId);
          if (teamIndex !== -1) {
             updatedTeams[teamIndex] = {
               ...updatedTeams[teamIndex],
               bingoCount: Math.max(0, updatedTeams[teamIndex].bingoCount - 1)
             };
             newLogs.push(`💔 ${updatedTeams[teamIndex].name}의 빙고 라인이 끊어졌습니다!`);
          }
        }
      }
    });

    if (brokenLines.length > 0) {
      updatedCompletedLines = updatedCompletedLines.filter(id => !brokenLines.includes(id));
      updatedWinningLines = updatedWinningLines.filter(line => !brokenLines.includes(line.id));
    }

    // 3. [신규 로직] 새로운 빙고 라인 탐색
    updatedTeams.forEach(team => {
      linePatterns.forEach(pattern => {
        const isFull = pattern.indices.every(idx => currentBoard[idx].owner === team.id);
        const lineUniqueId = `${team.id}-${pattern.id}`;

        if (isFull) {
           if (!updatedCompletedLines.includes(lineUniqueId)) {
             updatedCompletedLines.push(lineUniqueId);
             newBingoFound = true;

             const teamIdx = updatedTeams.findIndex(t => t.id === team.id);
             if (teamIdx !== -1) {
               updatedTeams[teamIdx] = {
                 ...updatedTeams[teamIdx],
                 bingoCount: updatedTeams[teamIdx].bingoCount + 1
               };
             }

             updatedWinningLines.push({
               id: lineUniqueId,
               startIndex: pattern.indices[0],
               endIndex: pattern.indices[pattern.indices.length - 1],
               color: team.hex
             });
           }
        }
      });
    });

    // 4. 승자 결정
    const winThreshold = size === 4 ? 2 : size === 5 ? 3 : 4;
    let winner: TeamId | null = null;
    updatedTeams.forEach(team => {
      if (team.bingoCount >= winThreshold && !winner) {
        winner = team.id;
      }
    });

    // 5. 상태 업데이트
    if (newBingoFound) {
      setShowBingoBurst(true);
      setTimeout(() => setShowBingoBurst(false), 2000);
      newLogs.push("BINGO 발생!");
    }

    if (winner) {
      newLogs.push(`🏆 ${updatedTeams.find(t=>t.id === winner)?.name} 승리!`);
    }

    setGameState(prev => ({
      ...prev,
      teams: updatedTeams,
      completedLines: updatedCompletedLines,
      winningLines: updatedWinningLines,
      winner: winner || prev.winner,
      status: winner ? 'gameover' : prev.status,
      board: currentBoard,
      logs: [...prev.logs, ...newLogs]
    }));

  }, [gameState.boardSize, gameState.teams, gameState.completedLines, gameState.winningLines]);


  // --- LOGIC: Handle Click ---
  const handleCellClick = (index: number) => {
    if (gameState.status !== 'playing') return;

    const cell = gameState.board[index];
    const currentTeam = gameState.teams.find(t => t.id === gameState.currentTurn);

    if (!currentTeam) return;
    if (cell.owner === currentTeam.id) return;

    // Check Steal Limit if occupied
    if (cell.owner !== null) {
      if (gameState.maxSteals !== 999 && currentTeam.stealCount >= gameState.maxSteals) {
        alert(`스틸 횟수를 모두 소진했습니다! (${currentTeam.stealCount}/${gameState.maxSteals})`);
        return;
      }
    }

    setConfirmModalState({
      isOpen: true,
      index,
      keyword: cell.keyword,
      isSteal: cell.owner !== null
    });
  };

  // --- LOGIC: Handle Confirmation ---
  const handleConfirmAction = () => {
    const { index, isSteal } = confirmModalState;
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));

    const cell = gameState.board[index];
    const currentTeam = gameState.teams.find(t => t.id === gameState.currentTurn);
    if (!currentTeam) return;

    if (isSteal) {
      // Open Steal Mini-Game Modal
      setStealModal({
        isOpen: true,
        targetCellIndex: index,
        challenger: currentTeam.id,
        defender: cell.owner as TeamId
      });
    } else {
      // Empty Cell Logic based on ClaimMode
      if (gameState.claimMode === 'QUIZ') {
        setQuizModal({
          isOpen: true,
          quiz: cell.quiz,
          targetCellIndex: index,
          challenger: currentTeam.id
        });
      } else {
        // Immediate Claim
        const newBoard = [...gameState.board];
        newBoard[index].owner = currentTeam.id;

        setGameState(prev => ({
          ...prev,
          currentTurn: (prev.currentTurn + 1) % prev.teamCount as TeamId,
          logs: [...prev.logs, `${currentTeam.name}가 ${cell.keyword} 점령`]
        }));

        checkBingo(newBoard);
      }
    }
  };

  // --- LOGIC: Quiz Result (Initial Claim) ---
  const handleQuizResult = (isCorrect: boolean) => {
    const { targetCellIndex, challenger } = quizModal;
    const currentTeam = gameState.teams.find(t => t.id === challenger);

    setQuizModal(prev => ({ ...prev, isOpen: false }));

    if (isCorrect && currentTeam) {
       const newBoard = [...gameState.board];
       newBoard[targetCellIndex].owner = challenger;

       setGameState(prev => ({
         ...prev,
         currentTurn: (prev.currentTurn + 1) % prev.teamCount as TeamId,
         logs: [...prev.logs, `🎯 ${currentTeam.name} 정답! ${gameState.board[targetCellIndex].keyword} 점령`]
       }));

       checkBingo(newBoard);
    } else {
      setGameState(prev => ({
        ...prev,
        currentTurn: (prev.currentTurn + 1) % prev.teamCount as TeamId,
        logs: [...prev.logs, `❌ 오답! 턴 종료`]
      }));
    }
  };

  // --- LOGIC: Steal Result (Mini Game) ---
  const handleStealResult = (challengerWon: boolean) => {
    const { targetCellIndex, challenger } = stealModal;
    const currentTeam = gameState.teams.find(t => t.id === challenger);

    setStealModal(prev => ({ ...prev, isOpen: false }));

    if (!currentTeam) return;

    // Update Steal Count regardless of result (Attempt counts)
    const updatedTeams = gameState.teams.map(t =>
      t.id === challenger ? { ...t, stealCount: t.stealCount + 1 } : t
    );

    if (challengerWon) {
      const newBoard = [...gameState.board];
      newBoard[targetCellIndex].owner = challenger;

      // 로그 및 턴 업데이트는 여기서 예약
      setGameState(prev => ({
        ...prev,
        currentTurn: (prev.currentTurn + 1) % prev.teamCount as TeamId,
        logs: [...prev.logs, `⚔️ ${currentTeam.name} 스틸 성공!`]
      }));

      // 스틸 횟수가 업데이트된 팀 정보를 checkBingo에 전달
      checkBingo(newBoard, updatedTeams);
    } else {
      setGameState(prev => ({
        ...prev,
        teams: updatedTeams,
        currentTurn: (prev.currentTurn + 1) % prev.teamCount as TeamId,
        logs: [...prev.logs, `🛡️ 방어 성공! 턴 종료`]
      }));
    }
  };

  // --- LOGIC: Open Quiz Bank Window ---
  const handleOpenQuizBank = () => {
    const allQuizzes = GET_ALL_QUIZ_DATA();
    const categories = CATEGORY_CONFIG;

    const newWindow = window.open('', '_blank', 'width=1000,height=900,menubar=no,toolbar=no');

    if (newWindow) {
      const quizRows = categories.map(cat => {
        const catQuizzes = allQuizzes.filter(q => q.category === cat.id);
        const rows = catQuizzes.map(q => `
          <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="p-3 font-bold border-r">${q.keyword}</td>
            <td class="p-3 text-sm border-r text-center">${q.type}</td>
            <td class="p-3 border-r max-w-xs break-words">${q.question}</td>
            <td class="p-3 border-r text-sm text-gray-600">${q.options ? q.options.map((o,i) => `(${i+1}) ${o}`).join('<br>') : '-'}</td>
            <td class="p-3 font-black text-red-600 border-r text-lg">${q.answer}</td>
            <td class="p-3 text-sm text-gray-500">${q.explanation}</td>
          </tr>
        `).join('');

        return `
          <div id="cat-${cat.id}" class="tab-content hidden">
            <h2 class="text-2xl font-black mb-4 p-2 bg-black text-white inline-block">${cat.label}</h2>
            <div class="overflow-x-auto">
              <table class="w-full border-4 border-black text-left border-collapse">
                <thead>
                  <tr class="bg-gray-100 border-b-4 border-black">
                    <th class="p-3 border-r border-black w-24">KEYWORD</th>
                    <th class="p-3 border-r border-black w-16">TYPE</th>
                    <th class="p-3 border-r border-black">QUESTION</th>
                    <th class="p-3 border-r border-black w-48">OPTIONS</th>
                    <th class="p-3 border-r border-black w-24">ANSWER</th>
                    <th class="p-3 border-black">EXPLANATION</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('');

      const tabs = categories.map((cat, idx) => `
        <button
          onclick="openTab('cat-${cat.id}')"
          class="px-6 py-3 font-black text-lg border-t-4 border-x-4 border-black hover:bg-yellow-200 transition-colors ${idx === 0 ? 'bg-black text-white' : 'bg-white text-black'}"
          id="btn-cat-${cat.id}"
        >
          ${cat.label}
        </button>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Quiz Bank - STEAL BINGO</title>
          <meta charset="utf-8" />
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
          <style>
             body { font-family: 'Pretendard', sans-serif; }
             .active-btn { background-color: black !important; color: white !important; }
          </style>
          <script>
             function openTab(id) {
                // Hide all
                document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('button').forEach(el => el.classList.remove('active-btn', 'bg-black', 'text-white'));
                document.querySelectorAll('button').forEach(el => el.classList.add('bg-white', 'text-black'));

                // Show selected
                document.getElementById(id).classList.remove('hidden');
                const btn = document.getElementById('btn-' + id);
                btn.classList.remove('bg-white', 'text-black');
                btn.classList.add('bg-black', 'text-white');
             }
          </script>
        </head>
        <body class="bg-gray-50 p-8">
          <h1 class="text-4xl font-black mb-8 tracking-tighter">📂 QUIZ BANK <span class="text-sm font-normal text-gray-500 ml-2">INSTRUCTOR CHEAT SHEET</span></h1>

          <div class="flex gap-2 mb-0 border-b-4 border-black">
            ${tabs}
          </div>

          <div class="bg-white p-6 border-x-4 border-b-4 border-black min-h-[500px] shadow-[8px_8px_0px_0px_#000]">
            ${quizRows}
          </div>

          <script>
            // Open first tab by default
            openTab('cat-${categories[0].id}');
          </script>
        </body>
        </html>
      `;

      newWindow.document.write(htmlContent);
      newWindow.document.close();
    }
  };

  // --- RENDER HELPERS ---
  const getLineCoordinates = (startIndex: number, endIndex: number) => {
    const size = gameState.boardSize;
    const startRow = Math.floor(startIndex / size);
    const startCol = startIndex % size;
    const endRow = Math.floor(endIndex / size);
    const endCol = endIndex % size;

    const cellWidth = 100 / size;
    const x1 = (startCol * cellWidth) + (cellWidth / 2);
    const y1 = (startRow * cellWidth) + (cellWidth / 2);
    const x2 = (endCol * cellWidth) + (cellWidth / 2);
    const y2 = (endRow * cellWidth) + (cellWidth / 2);

    return { x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%` };
  };

  // Get current teams for Steal Modal props
  const challengerTeam = gameState.teams.find(t => t.id === stealModal.challenger);
  const defenderTeam = gameState.teams.find(t => t.id === stealModal.defender);

  // --- UI: Setup Screen ---
  if (gameState.status === 'setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">

        {/* Global Instructor Tools - Top Right */}
        <div className="absolute top-6 right-6 flex gap-3 z-50">
           <button
            onClick={onExit}
            className="bg-white hover:bg-gray-200 text-black border-4 border-black px-4 py-2 font-black text-sm shadow-neo transition-all active:translate-y-1 active:shadow-none flex items-center gap-2"
          >
            <span>←</span> 메뉴
          </button>
           <button
            onClick={handleOpenQuizBank}
            className="bg-white hover:bg-yellow-300 text-black border-4 border-black px-4 py-2 font-black text-sm shadow-neo transition-all active:translate-y-1 active:shadow-none flex items-center gap-2"
          >
            <span>📂</span> 퀴즈 뱅크
          </button>
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="bg-white hover:bg-[#00E5FF] text-black border-4 border-black px-4 py-2 font-black text-sm shadow-neo transition-all active:translate-y-1 active:shadow-none flex items-center gap-2"
          >
            <span>📘</span> 강사 튜토리얼
          </button>
        </div>

        <div className="max-w-xl w-full bg-white border-4 border-black p-8 shadow-neo relative">

          <h1 className="text-4xl font-black text-black mb-2 tracking-tighter text-center">
            STEAL BINGO <span className="text-[#00E676] bg-black px-2">PRO</span>
          </h1>
          <p className="text-gray-600 text-center mb-8 font-mono text-sm font-bold">LOCAL MODE · 한 화면 핫시트</p>

          <div className="space-y-6">

            {/* Category Selection */}
            <div>
              <label className="block text-black font-black mb-2 uppercase border-b-2 border-black pb-1">1. QUIZ CATEGORY</label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_CONFIG.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setGameState(prev => ({ ...prev, selectedCategory: cat.id }))}
                    className={`p-3 border-4 text-left transition-all active:translate-y-1 ${
                      gameState.selectedCategory === cat.id
                      ? 'bg-black text-white border-black shadow-neo-sm'
                      : 'bg-white text-gray-500 border-gray-300 hover:border-black hover:text-black'
                    }`}
                  >
                    <div className="font-black text-sm">{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rules Configuration */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-black font-black mb-2 uppercase border-b-2 border-black pb-1">2. INITIAL CLAIM</label>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setGameState(prev => ({ ...prev, claimMode: 'QUIZ' }))}
                    className={`py-2 border-4 font-bold text-sm ${gameState.claimMode === 'QUIZ' ? 'bg-black text-white' : 'bg-white text-gray-400'}`}
                  >
                    QUIZ MODE
                  </button>
                  <button
                    onClick={() => setGameState(prev => ({ ...prev, claimMode: 'IMMEDIATE' }))}
                    className={`py-2 border-4 font-bold text-sm ${gameState.claimMode === 'IMMEDIATE' ? 'bg-black text-white' : 'bg-white text-gray-400'}`}
                  >
                    JUST CLICK
                  </button>
                </div>
              </div>
              <div>
                 <label className="block text-black font-black mb-2 uppercase border-b-2 border-black pb-1">3. STEAL LIMIT</label>
                 <div className="grid grid-cols-3 gap-2">
                   {[1, 3, 5, 10, 999].map(limit => (
                     <button
                       key={limit}
                       onClick={() => setGameState(prev => ({ ...prev, maxSteals: limit }))}
                       className={`py-2 border-4 font-bold text-sm ${gameState.maxSteals === limit ? 'bg-black text-white' : 'bg-white text-gray-400'}`}
                     >
                       {limit === 999 ? '∞' : limit}
                     </button>
                   ))}
                 </div>
              </div>
            </div>

            <div>
              <label className="block text-black font-black mb-2 uppercase border-b-2 border-black pb-1">4. BOARD & TEAMS</label>
              <div className="flex gap-4 mb-3">
                 <div className="flex-1 flex gap-1">
                    {[4, 5, 7].map(size => (
                      <button
                        key={size}
                        onClick={() => setGameState(prev => ({ ...prev, boardSize: size as 4|5|7 }))}
                        className={`flex-1 py-2 border-4 font-black text-lg ${gameState.boardSize === size ? 'bg-black text-white' : 'bg-white text-gray-400'}`}
                      >
                        {size}x{size}
                      </button>
                    ))}
                 </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5, 6, 7, 8, 9].map(count => (
                  <button
                    key={count}
                    onClick={() => setGameState(prev => ({ ...prev, teamCount: count }))}
                    className={`py-2 border-4 font-black text-lg ${gameState.teamCount === count ? 'bg-black text-white' : 'bg-white text-gray-400'}`}
                  >
                    {count}팀
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => initializeGame(gameState.boardSize, gameState.teamCount, gameState.selectedCategory, gameState.claimMode, gameState.maxSteals)}
              className="w-full py-4 mt-4 bg-[#00E676] text-black border-4 border-black font-black text-2xl shadow-neo hover:translate-y-1 hover:shadow-neo-hover transition-all"
            >
              GAME START
            </button>
          </div>
        </div>
        <Footer />

        {/* Tutorial Modal */}
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />
      </div>
    );
  }

  // --- UI: Game Screen ---
  return (
    <div className="min-h-screen flex flex-col items-center pb-20 relative overflow-hidden">

      {/* Header & Status */}
      <header className="w-full max-w-[1600px] p-4 flex justify-between items-center z-10">
        <div>
          <h1 className="text-3xl font-black text-black tracking-tighter drop-shadow-sm">STEAL BINGO</h1>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs bg-black text-white px-2 py-0.5 font-bold border-2 border-black">
               {CATEGORY_CONFIG.find(c => c.id === gameState.selectedCategory)?.label} ({gameState.boardSize}x{gameState.boardSize})
             </span>
             <button onClick={onExit} className="text-gray-400 hover:text-black transition-colors">
               <RefreshIcon />
             </button>
          </div>
        </div>

        {/* Turn Indicator */}
        <div className="flex flex-col items-end">
          <span className="text-xs text-black font-black font-mono mb-1 bg-white px-1">CURRENT TURN</span>
          <div className={`px-6 py-2 border-4 border-black font-black text-xl shadow-neo flex flex-col items-end ${
            gameState.teams.find(t => t.id === gameState.currentTurn)?.color
          } ${gameState.teams.find(t => t.id === gameState.currentTurn)?.textColor}`}>
            <span>{gameState.teams.find(t => t.id === gameState.currentTurn)?.name}</span>
            <span className="text-[10px] font-mono opacity-80 mt-1">
               STEALS: {gameState.teams.find(t => t.id === gameState.currentTurn)?.stealCount} / {gameState.maxSteals === 999 ? '∞' : gameState.maxSteals}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 w-full max-w-[1600px] p-4 flex flex-col md:flex-row items-center md:items-start justify-center gap-8 relative z-10">

        {/* LEFT: Team Scores (Scrollable for many teams) */}
        <div className="w-full md:w-72 flex flex-col gap-4 order-2 md:order-1 shrink-0 h-64 md:h-[650px]">
          <h3 className="hidden md:block text-black font-black text-xl uppercase tracking-widest border-b-4 border-black pb-2">Teams</h3>

          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-black p-2">
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              {gameState.teams.map(team => (
                <div key={team.id} className={`border-4 border-black p-3 relative transition-all duration-300 ${
                  team.id === gameState.currentTurn
                    ? 'opacity-100 shadow-neo translate-x-1 -translate-y-1'
                    : 'bg-white opacity-50 hover:opacity-100 grayscale hover:grayscale-0'
                } ${team.id === gameState.currentTurn ? team.color : 'bg-white'}`}>

                   <div className="flex flex-col relative z-10">
                      {/* Name and Active Indicator */}
                      <div className="flex justify-between items-center mb-1">
                        <span className={`font-black text-lg leading-none ${team.id === gameState.currentTurn ? team.textColor : 'text-black'}`}>{team.name}</span>
                        {team.id === gameState.currentTurn && (
                            <div className={`w-3 h-3 border-2 border-black rounded-full animate-pulse ${team.textColor === 'text-white' ? 'bg-white' : 'bg-black'}`}></div>
                        )}
                      </div>

                      {/* Stats Row: Lines and Steals side-by-side */}
                      <div className="flex justify-between items-end">
                        <div className="flex items-baseline gap-1">
                          <span className={`font-black text-4xl leading-none ${team.id === gameState.currentTurn ? team.textColor : 'text-black'}`}>
                            {team.bingoCount}
                          </span>
                          <span className={`text-xs font-bold ${team.id === gameState.currentTurn ? team.textColor : 'text-black'} opacity-80`}>LINES</span>
                        </div>

                        <div className={`text-xs font-bold flex items-center gap-1 ${team.id === gameState.currentTurn ? team.textColor : 'text-black'} opacity-90`}>
                           <span className="text-[10px]">⚔️</span>
                           <span>{team.stealCount}/{gameState.maxSteals === 999 ? '∞' : gameState.maxSteals}</span>
                        </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: Board */}
        <div className="flex-1 flex justify-center items-start order-1 md:order-2 w-full">
          <div
            ref={containerRef}
            className="relative bg-black border-4 border-black p-1 shadow-neo"
            style={{
              width: '100%',
              maxWidth: '650px',
              aspectRatio: '1/1',
            }}
          >
            <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible">
              {gameState.winningLines.map((line) => {
                const coords = getLineCoordinates(line.startIndex, line.endIndex);
                return (
                  <line
                    key={line.id}
                    x1={coords.x1} y1={coords.y1}
                    x2={coords.x2} y2={coords.y2}
                    stroke="#FF0000"
                    strokeWidth="10"
                    strokeLinecap="square"
                    className="draw-line opacity-90 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                  />
                );
              })}
            </svg>

            <div
              className="grid w-full h-full gap-1"
              style={{
                gridTemplateColumns: `repeat(${gameState.boardSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gameState.boardSize}, minmax(0, 1fr))`
              }}
            >
              {gameState.board.map((cell) => {
                const owner = cell.owner !== null ? gameState.teams.find(t => t.id === cell.owner) : null;
                return (
                  <div
                    key={cell.index}
                    onClick={() => handleCellClick(cell.index)}
                    className={`
                      relative border-0 cursor-pointer flex items-center justify-center p-1 text-center select-none transition-all overflow-hidden group
                      ${owner ? owner.color : 'bg-white hover:bg-gray-100'}
                      ${owner ? owner.textColor : 'text-black'}
                    `}
                  >
                    <div className={`absolute top-0 left-0 text-[10px] md:text-xs font-bold px-1.5 py-0.5 border-r-2 border-b-2 border-black z-10 transition-colors
                      ${owner ? 'bg-white text-black' : 'bg-black text-white group-hover:bg-[#FF0000]'}
                    `}>
                      {cell.index + 1}
                    </div>

                    <span className={`font-black leading-snug break-keep z-0 px-1 w-full flex items-center justify-center h-full ${
                      gameState.boardSize === 7 ? 'text-xs md:text-base' : 'text-sm md:text-2xl'
                    }`}>
                      {cell.keyword}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Logs */}
        <div className="w-full md:w-80 shrink-0 flex flex-col order-3 md:order-3 h-64 md:h-[650px]">
           <h3 className="hidden md:block text-black font-black text-xl uppercase tracking-widest border-b-4 border-black pb-2 mb-4">System Log</h3>
           <div className="w-full h-full bg-white border-4 border-black p-4 font-mono text-sm text-black overflow-y-auto shadow-neo scrollbar-thin scrollbar-thumb-black scrollbar-track-white">
              {gameState.logs.length === 0 && <p className="text-gray-400 italic font-bold">Waiting for game start...</p>}
              <div className="flex flex-col gap-3">
                {gameState.logs.slice().reverse().map((log, i) => (
                  <div key={i} className="pb-2 border-b-2 border-gray-100 last:border-0 animate-in fade-in slide-in-from-right-4 duration-300">
                    <span className="text-[#FF0000] mr-2 font-black">➜</span>
                    <span className="leading-relaxed break-words font-bold">{log}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>

      </div>

      {showBingoBurst && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <h1 className="text-[8rem] font-black text-[#FF0000] tracking-tighter drop-shadow-[10px_10px_0px_#000000] bingo-burst text-stroke">
            BINGO!
          </h1>
        </div>
      )}

      {gameState.status === 'gameover' && gameState.winner !== null && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-8 text-center max-w-md w-full shadow-[20px_20px_0px_0px_#FFD700]">
            <h2 className="text-6xl font-black mb-4 text-black">WINNER!</h2>
            <div className={`text-4xl font-bold mb-8 ${gameState.teams.find(t=>t.id === gameState.winner)?.color} ${gameState.teams.find(t=>t.id === gameState.winner)?.textColor} p-4 border-4 border-black inline-block shadow-neo`}>
              {gameState.teams.find(t => t.id === gameState.winner)?.name}
            </div>
            <button
              onClick={onExit}
              className="block w-full bg-black text-white font-bold py-4 text-xl hover:bg-gray-800 border-4 border-black shadow-neo hover:translate-y-1 hover:shadow-none transition-all"
            >
              NEW GAME
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        keyword={confirmModalState.keyword}
        isSteal={confirmModalState.isSteal}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
      />

      <QuizModal
        isOpen={quizModal.isOpen}
        quiz={quizModal.quiz}
        challengerTeamName={gameState.teams.find(t => t.id === quizModal.challenger)?.name || ''}
        defenderTeamName=''
        onAnswer={handleQuizResult}
        onClose={() => setQuizModal(prev => ({ ...prev, isOpen: false }))}
      />

      <StealModal
        isOpen={stealModal.isOpen}
        challengerTeamName={challengerTeam?.name || ''}
        challengerColor={challengerTeam?.color || 'bg-gray-200'}
        challengerTextColor={challengerTeam?.textColor || 'text-black'}
        defenderTeamName={defenderTeam?.name || ''}
        defenderColor={defenderTeam?.color || 'bg-gray-200'}
        defenderTextColor={defenderTeam?.textColor || 'text-black'}
        onResult={handleStealResult}
        onClose={() => setStealModal(prev => ({ ...prev, isOpen: false }))}
      />

      <Footer />
    </div>
  );
};

export default LocalGame;

// 팀 ID 정의 (0~8: 최대 9팀)
export type TeamId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// 문제 유형 정의
export type QuizType = 'OX' | 'MULTIPLE' | 'SHORT';

// 퀴즈 카테고리 정의
export type QuizCategory = 'HRD' | 'ETIQUETTE' | 'LEADERSHIP' | 'SECURITY';

// 초기 선점 규칙 (즉시 점령 vs 퀴즈 점령)
export type ClaimMode = 'IMMEDIATE' | 'QUIZ';

// HRD 퀴즈 데이터 인터페이스
export interface HRDQuiz {
  id: number;
  category: QuizCategory;
  type: QuizType;
  keyword: string; // 빙고 셀에 표시될 단어
  question: string;
  options?: string[]; // 4지선다용 보기 (없으면 null)
  answer: string; // OX: 'O'/'X', Multiple: 정답 텍스트, Short: 정답 텍스트
  explanation: string;
}

// 스틸 미니게임 인터페이스
export interface MiniGame {
  id: number;
  title: string;
  description: string;
}

// 빙고 셀 상태
export interface BingoCell {
  index: number;
  keyword: string;
  quiz: HRDQuiz;
  owner: TeamId | null;
  isLocked: boolean;
}

// 빙고 라인 좌표
export interface BingoLine {
  id: string;
  startIndex: number;
  endIndex: number;
  color: string;
}

// ===== 온라인 멀티플레이 타입 =====
export type GameMode = 'team' | 'individual';

export interface OnlineTeam {
  id: TeamId;
  name: string;
  color: string;
  hex: string;
  textColor: string;
  bingoCount: number;
  stealCount: number;
}

export interface OnlinePlayer {
  key: string;
  name: string;
  teamId: number | null;
  connected: boolean;
}

export interface LobbyTeam {
  id: number;
  name: string;
  color: string;
  hex: string;
  textColor: string;
  members: string[];
}

// active 메타 (퀴즈 본문/정답 제외 — 다른 조엔 "푸는 중"만)
export interface ActiveMeta {
  kind: 'quiz' | 'steal';
  cellIndex: number;
  keyword: string;
  challengerTeamId: number;
  defenderTeamId: number | null;
  miniGame: { id: number; title: string; description: string } | null;
}

// 서버가 보내는 공개 상태 (정답/문제본문 없음)
export interface RoomState {
  code: string;
  mode: GameMode;
  status: 'lobby' | 'playing' | 'gameover';
  settings: {
    boardSize: 4 | 5 | 7;
    claimMode: ClaimMode;
    maxSteals: number;
    category: string;
    teamCount: number;
  };
  lobbyTeams: LobbyTeam[];
  players: OnlinePlayer[];
  boardSize: 4 | 5 | 7;
  claimMode: ClaimMode;
  maxSteals: number;
  teams: OnlineTeam[];
  currentTurn: number;
  winThreshold: number;
  board: { index: number; keyword: string; owner: number | null }[];
  completedLines: string[];
  winningLines: BingoLine[];
  winner: number | null;
  logs: string[];
  active: ActiveMeta | null;
}

// 현재 턴 팀에게만 비공개로 전달되는 풀어야 할 문제 (정답 제외)
export interface PrivateQuiz {
  cellIndex: number;
  keyword: string;
  type: QuizType;
  question: string;
  options: string[] | null;
}

export interface QuizResult {
  correct: boolean;
  byTeamId: number;
  keyword: string;
  answer: string;
  explanation: string;
  submitted: string;
}

// 게임 전체 상태
export interface GameState {
  status: 'setup' | 'playing' | 'gameover';
  boardSize: 4 | 5 | 7;
  teamCount: number;
  selectedCategory: QuizCategory;
  claimMode: ClaimMode; // 빈 칸 선점 규칙
  maxSteals: number; // 팀별 최대 스틸 횟수 (999 = 무제한)
  teams: {
    id: TeamId;
    name: string;
    color: string;
    hex: string;
    textColor: string;
    bingoCount: number;
    stealCount: number; // 현재까지 사용한 스틸 횟수
  }[];
  currentTurn: TeamId;
  board: BingoCell[];
  completedLines: string[];
  winningLines: BingoLine[];
  winner: TeamId | null;
  logs: string[];
}
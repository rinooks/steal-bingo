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
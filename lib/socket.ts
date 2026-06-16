import { io, Socket } from 'socket.io-client';

// 개발 환경: 클라이언트(:5000)와 서버(:3001)가 분리 → 같은 호스트의 3001 로 접속.
// 프로덕션: 서버가 dist 를 직접 서빙 → 같은 오리진.
const isDev = import.meta.env.DEV;
export const SERVER_ORIGIN = isDev ? `${location.protocol}//${location.hostname}:3001` : '';
export const API_BASE = SERVER_ORIGIN; // '' 이면 same-origin

// 기기 식별용 키 (재접속 시 같은 플레이어로 인식)
export function getClientKey(): string {
  let key = localStorage.getItem('sb_client_key');
  if (!key) {
    key = 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('sb_client_key', key);
  }
  return key;
}

let socket: Socket | null = null;
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_ORIGIN || undefined, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

// 콜백 기반 emit 을 Promise 로
export function emitAck<T = any>(event: string, payload?: any): Promise<T> {
  return new Promise((resolve) => {
    getSocket().emit(event, payload, (res: T) => resolve(res));
  });
}

// ---- 문제은행 REST ----
export interface QuestionDTO {
  id?: number;
  category: string;
  type: 'OX' | 'MULTIPLE' | 'SHORT';
  keyword: string;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

export interface CategoryDTO {
  id: string;
  label: string;
  desc: string;
  count: number;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const QuizAPI = {
  list: (category?: string): Promise<QuestionDTO[]> =>
    api(`/api/questions${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  categories: (): Promise<CategoryDTO[]> => api('/api/categories'),
  create: (q: QuestionDTO): Promise<QuestionDTO> =>
    api('/api/questions', { method: 'POST', body: JSON.stringify(q) }),
  bulk: (arr: QuestionDTO[]): Promise<QuestionDTO[]> =>
    api('/api/questions', { method: 'POST', body: JSON.stringify(arr) }),
  update: (id: number, q: QuestionDTO): Promise<QuestionDTO> =>
    api(`/api/questions/${id}`, { method: 'PUT', body: JSON.stringify(q) }),
  remove: (id: number): Promise<{ ok: boolean }> =>
    api(`/api/questions/${id}`, { method: 'DELETE' }),
};

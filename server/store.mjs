// 문제은행 영구 저장소 (JSON 파일 기반)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BUILTIN_CATEGORIES } from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'questions.json');
const SEED_FILE = path.join(DATA_DIR, 'questions.seed.json');

let questions = [];
let nextId = 1;

function ensureLoaded() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(DB_FILE)) {
    questions = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else if (fs.existsSync(SEED_FILE)) {
    // 최초 실행: 시드 데이터를 영구 DB 로 복사
    questions = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    persist();
  } else {
    questions = [];
    persist();
  }
  nextId = questions.reduce((m, q) => Math.max(m, q.id || 0), 0) + 1;
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(questions, null, 2));
}

ensureLoaded();

export function getAll() {
  return questions;
}

export function getByCategory(category) {
  return questions.filter((q) => q.category === category);
}

// 사용 가능한 카테고리 목록 + 문제 수
export function getCategories() {
  const counts = {};
  for (const q of questions) counts[q.category] = (counts[q.category] || 0) + 1;

  const seen = new Set();
  const list = [];

  // 빌트인 먼저 (라벨 유지)
  for (const c of BUILTIN_CATEGORIES) {
    list.push({ id: c.id, label: c.label, desc: c.desc, count: counts[c.id] || 0 });
    seen.add(c.id);
  }
  // 관리자가 추가한 커스텀 카테고리
  for (const cat of Object.keys(counts)) {
    if (!seen.has(cat)) {
      list.push({ id: cat, label: cat, desc: '관리자 등록 카테고리', count: counts[cat] });
      seen.add(cat);
    }
  }
  return list;
}

function normalize(input) {
  const type = ['OX', 'MULTIPLE', 'SHORT'].includes(input.type) ? input.type : 'OX';
  return {
    category: String(input.category || 'HRD').trim() || 'HRD',
    type,
    keyword: String(input.keyword || '').trim(),
    question: String(input.question || '').trim(),
    options: type === 'MULTIPLE' ? (Array.isArray(input.options) ? input.options.map((o) => String(o)) : []) : undefined,
    answer: String(input.answer || '').trim(),
    explanation: String(input.explanation || '').trim(),
  };
}

export function addQuestion(input) {
  const q = { id: nextId++, ...normalize(input) };
  questions.push(q);
  persist();
  return q;
}

export function updateQuestion(id, input) {
  const idx = questions.findIndex((q) => q.id === Number(id));
  if (idx === -1) return null;
  questions[idx] = { ...questions[idx], ...normalize(input), id: Number(id) };
  persist();
  return questions[idx];
}

export function deleteQuestion(id) {
  const idx = questions.findIndex((q) => q.id === Number(id));
  if (idx === -1) return false;
  questions.splice(idx, 1);
  persist();
  return true;
}

// 여러 문제 일괄 등록 (CSV/붙여넣기)
export function bulkAdd(arr) {
  const added = [];
  for (const item of arr) {
    if (!item || !item.question) continue;
    added.push(addQuestion(item));
  }
  return added;
}

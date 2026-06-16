import React, { useEffect, useState } from 'react';
import { QuizAPI, QuestionDTO, CategoryDTO } from '../lib/socket';

type QType = 'OX' | 'MULTIPLE' | 'SHORT';

const emptyForm = (category: string): QuestionDTO => ({
  category,
  type: 'OX',
  keyword: '',
  question: '',
  options: ['', '', '', ''],
  answer: '',
  explanation: '',
});

const Admin: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [active, setActive] = useState<string>('HRD');
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [form, setForm] = useState<QuestionDTO>(emptyForm('HRD'));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newCat, setNewCat] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const loadCategories = async () => {
    try {
      const cats = await QuizAPI.categories();
      setCategories(cats);
      if (!cats.find((c) => c.id === active) && cats.length) setActive(cats[0].id);
    } catch (e: any) {
      setError('서버에 연결할 수 없습니다. 서버(npm run server)가 켜져 있는지 확인하세요.');
    }
  };
  const loadQuestions = async (cat: string) => {
    try {
      setLoading(true);
      setQuestions(await QuizAPI.list(cat));
    } catch {
      setError('문제를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { if (active) { loadQuestions(active); setForm((f) => ({ ...emptyForm(active) })); setEditingId(null); } }, [active]);

  const startEdit = (q: QuestionDTO) => {
    setEditingId(q.id!);
    setForm({ ...q, options: q.options && q.options.length ? q.options : ['', '', '', ''] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const resetForm = () => { setForm(emptyForm(active)); setEditingId(null); };

  const validate = (): string | null => {
    if (!form.keyword.trim()) return '키워드(빙고 칸 단어)를 입력하세요.';
    if (!form.question.trim()) return '문제 내용을 입력하세요.';
    if (form.type === 'OX' && !['O', 'X'].includes(form.answer.trim().toUpperCase())) return 'OX 문제의 정답은 O 또는 X 여야 합니다.';
    if (form.type === 'MULTIPLE') {
      const opts = (form.options || []).map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return '4지선다는 보기를 2개 이상 입력하세요.';
      if (!opts.includes(form.answer.trim())) return '정답은 보기 중 하나와 정확히 일치해야 합니다.';
    }
    if (!form.answer.trim()) return '정답을 입력하세요.';
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setError('');
    const payload: QuestionDTO = {
      ...form,
      answer: form.type === 'OX' ? form.answer.trim().toUpperCase() : form.answer.trim(),
      options: form.type === 'MULTIPLE' ? (form.options || []).map((o) => o.trim()).filter(Boolean) : undefined,
    };
    try {
      if (editingId) await QuizAPI.update(editingId, payload);
      else await QuizAPI.create(payload);
      setEditingId(null);
      await loadCategories();
      // 저장한 문제의 카테고리 탭으로 전환 (신규 카테고리면 새 탭이 생김)
      if (payload.category !== active) setActive(payload.category);
      else { await loadQuestions(active); setForm(emptyForm(active)); }
    } catch {
      setError('저장 실패. 서버 상태를 확인하세요.');
    }
  };

  // 신규 카테고리: 폼의 카테고리를 새 이름으로 설정 (첫 문제 등록 시 탭이 생성됨)
  const addCategory = () => {
    const name = newCat.trim();
    if (!name) return;
    if (categories.find((c) => c.id === name)) { setActive(name); }
    else { setForm({ ...emptyForm(name) }); setEditingId(null); }
    setNewCat('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: number) => {
    if (!confirm('이 문제를 삭제할까요?')) return;
    await QuizAPI.remove(id);
    await loadCategories();
    await loadQuestions(active);
    if (editingId === id) resetForm();
  };

  const doBulk = async () => {
    setError('');
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const arr: QuestionDTO[] = [];
    for (const line of lines) {
      // 형식: 카테고리 \t 유형 \t 키워드 \t 문제 \t 보기(| 구분) \t 정답 \t 해설
      const p = line.split('\t').map((s) => s.trim());
      if (p.length < 6) continue;
      const [category, typeRaw, keyword, question, optionsRaw, answer, explanation = ''] = p;
      const type = (['OX', 'MULTIPLE', 'SHORT'].includes(typeRaw.toUpperCase()) ? typeRaw.toUpperCase() : 'OX') as QType;
      arr.push({
        category: category || active,
        type,
        keyword,
        question,
        options: type === 'MULTIPLE' ? optionsRaw.split('|').map((s) => s.trim()).filter(Boolean) : undefined,
        answer,
        explanation,
      });
    }
    if (!arr.length) { setError('인식된 문제가 없습니다. 탭(Tab)으로 구분된 형식을 확인하세요.'); return; }
    try {
      await QuizAPI.bulk(arr);
      setBulkText(''); setShowBulk(false);
      await loadCategories();
      await loadQuestions(active);
    } catch {
      setError('일괄 등록 실패.');
    }
  };

  const inputCls = 'w-full p-3 border-4 border-black font-bold outline-none focus:bg-yellow-50';
  const labelCls = 'block text-xs font-black uppercase mb-1 text-gray-600';

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter">🛠️ 문제 관리자</h1>
          <p className="text-sm font-bold text-gray-500 mt-1">문제 출제 · 등록 · 수정 · 삭제 (서버 영구 저장)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="bg-white border-4 border-black px-4 py-2 font-black shadow-neo-sm hover:bg-yellow-200 active:translate-y-1 active:shadow-none">📋 일괄등록</button>
          <button onClick={() => navigate('/')} className="bg-black text-white border-4 border-black px-4 py-2 font-black shadow-neo-sm active:translate-y-1 active:shadow-none">← 메뉴</button>
        </div>
      </div>

      {error && <div className="bg-[#FF1744] text-white border-4 border-black p-3 font-bold mb-4 shadow-neo-sm">{error}</div>}

      {/* Category Tabs + 신규 카테고리 추가 */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={`px-4 py-2 border-4 border-black font-black text-sm ${active === c.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
          >
            {c.label} <span className="opacity-60 ml-1">({c.count})</span>
          </button>
        ))}
        <div className="flex items-center gap-1 ml-1 bg-[#FFD700] border-4 border-black px-2 py-1">
          <span className="font-black text-sm">➕</span>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
            placeholder="새 카테고리"
            className="w-28 bg-transparent outline-none font-bold text-sm placeholder:text-black/50"
          />
          <button onClick={addCategory} className="bg-black text-white font-black text-xs px-2 py-1">추가</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="bg-white border-4 border-black p-5 shadow-neo h-fit lg:sticky lg:top-4">
          <h2 className="text-xl font-black mb-4 border-b-4 border-black pb-2">
            {editingId ? `✏️ 문제 수정 #${editingId}` : '➕ 새 문제 출제'}
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>카테고리</label>
                <input
                  className={inputCls}
                  list="cat-list"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="예: HRD"
                />
                <datalist id="cat-list">
                  {categories.map((c) => <option key={c.id} value={c.id} />)}
                </datalist>
                <p className="text-[10px] font-bold text-gray-400 mt-1">목록에 없는 이름을 입력하면 신규 카테고리로 생성됩니다.</p>
              </div>
              <div>
                <label className={labelCls}>유형</label>
                <div className="flex gap-1">
                  {(['OX', 'MULTIPLE', 'SHORT'] as QType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t, answer: '' })}
                      className={`flex-1 py-3 border-4 border-black font-black text-xs ${form.type === t ? 'bg-black text-white' : 'bg-white'}`}
                    >
                      {t === 'OX' ? 'OX' : t === 'MULTIPLE' ? '4지선다' : '단답'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>키워드 (빙고 칸에 표시될 단어)</label>
              <input className={inputCls} value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="예: ADDIE" />
            </div>

            <div>
              <label className={labelCls}>문제</label>
              <textarea className={`${inputCls} min-h-[80px]`} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="문제 내용을 입력하세요" />
            </div>

            {form.type === 'MULTIPLE' && (
              <div>
                <label className={labelCls}>보기 (정답은 아래 정답란에 동일하게 입력)</label>
                <div className="space-y-2">
                  {(form.options || []).map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-black w-6 text-center">{i + 1}</span>
                      <input
                        className={inputCls}
                        value={opt}
                        onChange={(e) => {
                          const next = [...(form.options || [])];
                          next[i] = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                        placeholder={`보기 ${i + 1}`}
                      />
                      <button
                        onClick={() => setForm({ ...form, answer: opt })}
                        className={`px-3 py-2 border-4 border-black font-black text-xs whitespace-nowrap ${form.answer && form.answer === opt ? 'bg-[#00E676]' : 'bg-white'}`}
                      >정답</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>정답</label>
              {form.type === 'OX' ? (
                <div className="flex gap-2">
                  {['O', 'X'].map((v) => (
                    <button key={v} onClick={() => setForm({ ...form, answer: v })} className={`flex-1 py-3 border-4 border-black font-black text-2xl ${form.answer === v ? 'bg-[#00E676]' : 'bg-white'}`}>{v}</button>
                  ))}
                </div>
              ) : (
                <input className={inputCls} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder={form.type === 'MULTIPLE' ? '보기 중 정답을 그대로 입력' : '정답 텍스트'} />
              )}
            </div>

            <div>
              <label className={labelCls}>해설</label>
              <textarea className={`${inputCls} min-h-[60px]`} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} placeholder="정답 해설 (선택)" />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={submit} className="flex-1 py-4 bg-[#00E676] border-4 border-black font-black text-xl shadow-neo-sm active:translate-y-1 active:shadow-none">
                {editingId ? '수정 저장' : '문제 등록'}
              </button>
              {editingId && (
                <button onClick={resetForm} className="px-5 py-4 bg-white border-4 border-black font-black shadow-neo-sm active:translate-y-1 active:shadow-none">취소</button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div>
          <h2 className="text-xl font-black mb-3">📚 등록된 문제 {loading ? '...' : `(${questions.length})`}</h2>
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="bg-white border-4 border-black p-3 shadow-neo-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black bg-black text-white px-2 py-0.5">{q.keyword}</span>
                      <span className="text-xs font-bold bg-gray-200 px-2 py-0.5 border-2 border-black">{q.type}</span>
                    </div>
                    <p className="font-bold text-sm break-keep">{q.question}</p>
                    {q.type === 'MULTIPLE' && q.options && (
                      <p className="text-xs text-gray-500 mt-1">{q.options.map((o, i) => `${i + 1}.${o}`).join('  ')}</p>
                    )}
                    <p className="text-sm font-black text-[#FF1744] mt-1">정답: {q.answer}</p>
                    {q.explanation && <p className="text-xs text-gray-500 mt-0.5">{q.explanation}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => startEdit(q)} className="px-3 py-1 bg-[#FFD700] border-2 border-black font-black text-xs">수정</button>
                    <button onClick={() => remove(q.id!)} className="px-3 py-1 bg-white border-2 border-black font-black text-xs hover:bg-[#FF1744] hover:text-white">삭제</button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && questions.length === 0 && (
              <div className="text-gray-400 font-bold italic border-4 border-dashed border-gray-300 p-8 text-center">등록된 문제가 없습니다. 왼쪽에서 출제하세요.</div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-2xl shadow-[16px_16px_0_0_#000] p-6">
            <h3 className="text-xl font-black mb-2">📋 일괄 등록</h3>
            <p className="text-xs font-bold text-gray-600 mb-3">
              한 줄에 한 문제. <span className="bg-black text-white px-1">탭(Tab)</span>으로 구분:
              <br />카테고리 ⇥ 유형(OX/MULTIPLE/SHORT) ⇥ 키워드 ⇥ 문제 ⇥ 보기(| 로구분) ⇥ 정답 ⇥ 해설
              <br />엑셀/구글시트에서 복사하면 자동으로 탭 구분됩니다.
            </p>
            <textarea
              className="w-full h-56 p-3 border-4 border-black font-mono text-xs outline-none focus:bg-yellow-50"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`HRD\tOX\t예시키워드\t이것은 OX 문제입니다.\t\tO\t해설입니다.\nHRD\tMULTIPLE\t사지선다\t다음 중 옳은 것은?\t보기1|보기2|보기3|보기4\t보기2\t해설`}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={doBulk} className="flex-1 py-3 bg-[#00E676] border-4 border-black font-black">등록</button>
              <button onClick={() => setShowBulk(false)} className="px-6 py-3 bg-white border-4 border-black font-black">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;

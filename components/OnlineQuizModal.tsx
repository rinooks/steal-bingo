import React, { useEffect, useState } from 'react';
import { PrivateQuiz } from '../types';

interface Props {
  quiz: PrivateQuiz;
  teamName: string;
  onSubmit: (answer: string) => void;
}

// 현재 턴 팀만 보는 풀이 모달 (정답/해설은 서버가 가지고 있어 여기엔 없음 — 치팅 방지)
const OnlineQuizModal: React.FC<Props> = ({ quiz, teamName, onSubmit }) => {
  const [shortInput, setShortInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { setShortInput(''); setSubmitted(false); }, [quiz.cellIndex]);

  const send = (answer: string) => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit(answer);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border-4 border-black w-full max-w-xl shadow-[20px_20px_0px_0px_#000000]">
        <div className="bg-black p-6 text-center border-b-4 border-black">
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">QUIZ MISSION 🔒</h2>
          <p className="text-white mt-2 text-base font-bold">
            <span className="text-team-3 text-xl">{teamName}</span>
            <span className="text-white/60 text-sm ml-2">우리 팀만 보입니다</span>
          </p>
        </div>

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="text-sm font-black bg-black text-white px-3 py-1 border-2 border-black">KEYWORD: {quiz.keyword}</div>
            <div className="text-sm font-black bg-gray-200 text-black px-3 py-1 border-2 border-black">
              {quiz.type === 'OX' ? 'OX 퀴즈' : quiz.type === 'MULTIPLE' ? '4지선다' : '단답형'}
            </div>
          </div>

          <p className="text-2xl font-black leading-snug mb-10 text-black break-keep min-h-[5rem]">{quiz.question}</p>

          {submitted ? (
            <div className="text-center py-8 font-black text-xl text-gray-500">제출 완료! 결과를 기다리는 중...</div>
          ) : quiz.type === 'OX' ? (
            <div className="flex gap-4 h-32">
              <button onClick={() => send('O')} className="flex-1 bg-white border-4 border-black text-6xl font-black hover:bg-team-4 hover:text-white transition-all shadow-neo active:translate-y-1 active:shadow-none">O</button>
              <button onClick={() => send('X')} className="flex-1 bg-white border-4 border-black text-6xl font-black hover:bg-team-1 hover:text-white transition-all shadow-neo active:translate-y-1 active:shadow-none">X</button>
            </div>
          ) : quiz.type === 'MULTIPLE' ? (
            <div className="grid grid-cols-1 gap-3">
              {quiz.options?.map((option, idx) => (
                <button key={idx} onClick={() => send(option)} className="w-full py-4 px-6 bg-white border-4 border-black font-bold text-xl text-left hover:bg-gray-100 hover:translate-x-1 transition-all shadow-neo-sm active:shadow-none active:translate-y-1 group">
                  <span className="inline-block w-8 h-8 bg-black text-white text-center leading-7 mr-4 border border-black font-black group-hover:bg-team-3 group-hover:text-black">{idx + 1}</span>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={shortInput}
                onChange={(e) => setShortInput(e.target.value)}
                placeholder="정답을 입력하세요"
                className="w-full p-4 text-2xl font-bold border-4 border-black outline-none focus:bg-yellow-50 placeholder:text-gray-300 shadow-neo-sm"
                onKeyDown={(e) => { if (e.key === 'Enter' && shortInput.trim()) send(shortInput); }}
                autoFocus
              />
              <button onClick={() => shortInput.trim() && send(shortInput)} className="w-full py-4 bg-black text-white font-black text-2xl border-4 border-black hover:bg-gray-800 shadow-neo active:shadow-none active:translate-y-1">제출하기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnlineQuizModal;

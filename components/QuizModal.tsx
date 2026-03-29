import React, { useState, useEffect } from 'react';
import { HRDQuiz } from '../types';

interface QuizModalProps {
  isOpen: boolean;
  quiz: HRDQuiz | null;
  challengerTeamName: string;
  defenderTeamName: string;
  onAnswer: (isCorrect: boolean) => void;
  onClose: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ 
  isOpen, 
  quiz, 
  challengerTeamName, 
  defenderTeamName, 
  onAnswer 
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [shortInput, setShortInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Reset state when quiz opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAnswer(null);
      setShortInput('');
      setShowResult(false);
      setIsCorrect(false);
    }
  }, [isOpen, quiz]);

  if (!isOpen || !quiz) return null;

  const handleSubmit = (answer: string) => {
    if (showResult) return;

    let correct = false;
    
    if (quiz.type === 'SHORT') {
      const normalizedInput = answer.replace(/\s+/g, '').toLowerCase();
      const normalizedAnswer = quiz.answer.replace(/\s+/g, '').toLowerCase();
      
      correct = normalizedInput === normalizedAnswer || 
                (quiz.answer === '디도스' && normalizedInput === 'ddos') ||
                (quiz.answer === 'ASAP' && normalizedInput === '아삽'); 
    } else {
      correct = answer === quiz.answer;
    }

    setSelectedAnswer(answer);
    setIsCorrect(correct);
    setShowResult(true);

    // Removed setTimeout to allow user to read explanation manually
  };

  const renderQuizContent = () => {
    if (showResult) {
      return (
        <div className={`p-8 text-center border-4 border-black ${isCorrect ? 'bg-team-4' : 'bg-team-1'}`}>
          {/* Updated Success/Fail Text Styling for Maximum Visibility */}
          <h3 
            className="text-6xl font-black text-white mb-6 tracking-tighter italic"
            style={{ 
              WebkitTextStroke: '2px black',
              textShadow: '6px 6px 0px #000000'
            }}
          >
            {isCorrect ? 'SUCCESS!' : 'FAILED!'}
          </h3>
          
          <p className="text-black font-black text-xl bg-white inline-block px-6 py-2 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] mb-8">
            {isCorrect ? '정답입니다! 땅을 획득했습니다.' : '오답입니다! 턴이 넘어갑니다.'}
          </p>

          <div className="text-black text-base font-bold p-6 bg-white border-4 border-black text-left shadow-neo-sm">
             <p className="mb-2 text-xs text-gray-500 uppercase font-black">정답 및 해설</p>
             <p className="text-2xl font-black text-team-1 mb-3">정답: {quiz.answer}</p>
             <p className="leading-relaxed">{quiz.explanation}</p>
          </div>

          <button 
            onClick={() => onAnswer(isCorrect)}
            className="mt-6 w-full py-4 bg-black text-white font-black text-xl border-4 border-black shadow-[4px_4px_0px_0px_#FFFFFF] hover:bg-gray-800 transition-all active:translate-y-1 active:shadow-none"
          >
            확인 (NEXT)
          </button>
        </div>
      );
    }

    switch (quiz.type) {
      case 'OX':
        return (
          <div className="flex gap-4 h-32">
            <button 
              onClick={() => handleSubmit('O')}
              className="flex-1 bg-white border-4 border-black text-6xl font-black text-black hover:bg-team-4 hover:text-white transition-all shadow-neo active:translate-y-1 active:shadow-none"
            >
              O
            </button>
            <button 
              onClick={() => handleSubmit('X')}
              className="flex-1 bg-white border-4 border-black text-6xl font-black text-black hover:bg-team-1 hover:text-white transition-all shadow-neo active:translate-y-1 active:shadow-none"
            >
              X
            </button>
          </div>
        );
      
      case 'MULTIPLE':
        return (
          <div className="grid grid-cols-1 gap-3">
            {quiz.options?.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleSubmit(option)}
                className="w-full py-4 px-6 bg-white border-4 border-black font-bold text-xl text-left hover:bg-gray-100 hover:translate-x-1 transition-all shadow-neo-sm active:shadow-none active:translate-y-1 group"
              >
                <span className="inline-block w-8 h-8 bg-black text-white text-center leading-7 mr-4 border border-black font-black group-hover:bg-team-3 group-hover:text-black transition-colors">{idx + 1}</span>
                {option}
              </button>
            ))}
          </div>
        );

      case 'SHORT':
        return (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={shortInput}
              onChange={(e) => setShortInput(e.target.value)}
              placeholder="정답을 입력하세요"
              className="w-full p-4 text-2xl font-bold border-4 border-black outline-none focus:bg-yellow-50 placeholder:text-gray-300 shadow-neo-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && shortInput.trim()) handleSubmit(shortInput);
              }}
              autoFocus
            />
            <button
              onClick={() => shortInput.trim() && handleSubmit(shortInput)}
              className="w-full py-4 bg-black text-white font-black text-2xl border-4 border-black hover:bg-gray-800 transition-all shadow-neo active:shadow-none active:translate-y-1"
            >
              제출하기
            </button>
          </div>
        );
        
      default:
        return <div>Unsupported Quiz Type</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border-4 border-black w-full max-w-xl shadow-[20px_20px_0px_0px_#000000]">
        {/* Header */}
        <div className="bg-black p-6 text-center border-b-4 border-black relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')]"></div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase relative z-10">
            HRD QUIZ MISSION
          </h2>
          <p className="text-white mt-2 text-base font-bold relative z-10 flex items-center justify-center gap-2">
            <span className="text-team-3 text-xl">{challengerTeamName}</span>
            {defenderTeamName && (
              <>
                <span className="text-white/60 text-sm">VS</span>
                <span className="text-team-2 text-xl">{defenderTeamName}</span>
              </>
            )}
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
             <div className="text-sm font-black bg-black text-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#888]">
               KEYWORD: {quiz.keyword}
             </div>
             <div className="text-sm font-black bg-gray-200 text-black px-3 py-1 border-2 border-black">
               {quiz.type === 'OX' ? 'OX 퀴즈' : quiz.type === 'MULTIPLE' ? '4지선다' : '단답형'}
             </div>
          </div>
          
          <p className="text-2xl font-black leading-snug mb-10 text-black break-keep min-h-[5rem]">
            {quiz.question}
          </p>

          {renderQuizContent()}
        </div>
      </div>
    </div>
  );
};

export default QuizModal;
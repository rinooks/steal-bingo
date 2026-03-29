import React, { useState } from 'react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: "1. 게임 소개",
    icon: "🎮",
    content: "스틸 빙고(Steal Bingo)는 팀 대항 경쟁 게임입니다.\n빙고판의 키워드를 선점하여 가로, 세로, 대각선 줄을 완성해야 합니다.\n단순한 빙고와 달리 상대방의 땅을 뺏을 수 있는 '스틸(Steal)' 요소가 있어 끝까지 긴장을 늦출 수 없습니다."
  },
  {
    title: "2. 게임 준비",
    icon: "⚙️",
    content: "강사님은 시작 화면에서 다음을 설정해주세요.\n\n1. 퀴즈 카테고리 (HRD, 예절 등)\n2. 선점 방식 (퀴즈 풀기 vs 즉시 점령)\n3. 스틸 제한 횟수 (팀별 공격 기회)\n4. 보드 크기 및 참여 팀 수\n\n설정이 끝나면 'GAME START'를 눌러주세요."
  },
  {
    title: "3. 턴 진행 및 키워드 선택",
    icon: "point_up",
    content: "화면 상단에 'CURRENT TURN'으로 표시된 팀이 공격권을 가집니다.\n해당 팀은 빙고판에서 원하는 키워드를 하나 선택합니다.\n\n- 빈 칸 선택 시: 퀴즈 미션 진행\n- 상대방 땅 선택 시: 스틸 배틀 진행"
  },
  {
    title: "4. 땅 점령하기 (퀴즈)",
    icon: "📝",
    content: "빈 칸을 선택하면 해당 키워드와 관련된 OX, 객관식, 또는 단답형 퀴즈가 출제됩니다.\n\n- 정답: 해당 칸을 우리 팀 색깔로 점령하고 턴 종료.\n- 오답: 점령 실패, 다음 팀으로 턴이 넘어갑니다."
  },
  {
    title: "5. 스틸 (땅 뺏기)",
    icon: "⚔️",
    content: "이미 상대가 점령한 땅을 선택하면 '스틸 배틀'이 발생합니다.\n시스템이 랜덤으로 미니게임(가위바위보, 눈싸움 등)을 지정해줍니다.\n\n- 공격 성공: 상대 땅을 뺏어오고 우리 팀 땅이 됩니다.\n- 방어 성공: 땅 주인은 그대로 유지됩니다.\n* 스틸은 팀별로 횟수 제한이 있으니 신중해야 합니다!"
  },
  {
    title: "6. 승리 조건",
    icon: "🏆",
    content: "가로, 세로, 대각선으로 줄을 완성하면 'BINGO'가 됩니다.\n보드 크기에 따라 승리 기준(빙고 2~4줄)을 먼저 달성한 팀이 최종 우승합니다.\n\n상대의 빙고 길목을 스틸로 끊어내는 것이 전략의 핵심입니다!"
  }
];

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
      setCurrentStep(0);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border-4 border-black w-full max-w-2xl shadow-[15px_15px_0px_0px_#00E5FF] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-black p-4 flex justify-between items-center border-b-4 border-black">
          <h2 className="text-2xl font-black text-[#00E5FF] tracking-tighter uppercase flex items-center gap-2">
            📘 INSTRUCTOR GUIDE
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8 flex-1 overflow-y-auto flex flex-col items-center text-center">
            
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-5xl mb-6 border-4 border-black shadow-neo-sm">
                {TUTORIAL_STEPS[currentStep].icon === 'point_up' ? 
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg> 
                  : TUTORIAL_STEPS[currentStep].icon
                }
            </div>

            <h3 className="text-2xl font-black mb-6 text-black border-b-4 border-[#00E5FF] inline-block px-4 pb-1">
                {TUTORIAL_STEPS[currentStep].title}
            </h3>

            <p className="text-lg font-bold text-gray-700 leading-loose whitespace-pre-line max-w-lg">
                {TUTORIAL_STEPS[currentStep].content}
            </p>

        </div>

        {/* Footer / Navigation */}
        <div className="p-4 bg-gray-50 border-t-4 border-black flex justify-between items-center">
            
            {/* Dots Indicator */}
            <div className="flex gap-2">
                {TUTORIAL_STEPS.map((_, idx) => (
                    <div 
                        key={idx}
                        className={`w-3 h-3 rounded-full border-2 border-black ${idx === currentStep ? 'bg-black' : 'bg-white'}`}
                    />
                ))}
            </div>

            <div className="flex gap-3">
                <button 
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className={`px-6 py-2 border-4 border-black font-black text-sm transition-all ${
                        currentStep === 0 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-400' 
                        : 'bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_#000000] active:translate-y-1 active:shadow-none'
                    }`}
                >
                    PREV
                </button>
                <button 
                    onClick={handleNext}
                    className="px-6 py-2 bg-black text-white border-4 border-black font-black text-sm hover:bg-gray-800 shadow-[2px_2px_0px_0px_#888888] active:translate-y-1 active:shadow-none transition-all"
                >
                    {currentStep === TUTORIAL_STEPS.length - 1 ? 'CLOSE' : 'NEXT'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
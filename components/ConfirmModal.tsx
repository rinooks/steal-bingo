import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  keyword: string;
  isSteal: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, keyword, isSteal, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
       <div className="bg-white border-4 border-black w-full max-w-sm shadow-[12px_12px_0px_0px_#000000] relative">
          <div className="bg-black p-4 border-b-4 border-black flex justify-between items-center">
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">
              {isSteal ? 'STEAL TARGET' : 'CLAIM TARGET'}
            </h2>
          </div>
          
          <div className="p-6 flex flex-col items-center text-center">
            <div className="mb-6 w-full">
                <span className="text-xs font-bold bg-gray-200 text-black px-2 py-1 mb-2 inline-block border-2 border-black">SELECTED KEYWORD</span>
                <p className="text-2xl font-black text-black leading-tight break-keep mt-2 min-h-[3rem] flex items-center justify-center">
                  {keyword}
                </p>
            </div>
            
            <p className="text-sm font-bold mb-6 text-black bg-gray-50 p-4 border-2 border-dashed border-gray-400 w-full rounded-none">
                {isSteal 
                    ? "상대방의 땅입니다.\n스틸 챌린지를 진행하시겠습니까?" 
                    : "이 키워드를 선택하여\n턴을 마치시겠습니까?"}
            </p>

            <div className="flex w-full gap-3">
              <button 
                onClick={onCancel}
                className="flex-1 py-4 border-4 border-black font-black bg-white hover:bg-gray-100 text-black transition-all active:translate-y-1 shadow-[4px_4px_0px_0px_#000000] active:shadow-none"
              >
                NO
              </button>
              <button 
                onClick={onConfirm}
                className={`flex-1 py-4 border-4 border-black font-black transition-all shadow-[4px_4px_0px_0px_#000000] active:translate-y-1 active:shadow-none ${
                    isSteal 
                    ? 'bg-[#FF0000] text-white hover:bg-red-600' 
                    : 'bg-[#00E676] text-black hover:bg-[#00C853]'
                }`}
              >
                YES
              </button>
            </div>
          </div>
       </div>
    </div>
  );
};

export default ConfirmModal;
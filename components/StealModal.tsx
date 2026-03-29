import React, { useState, useEffect } from 'react';
import { MiniGame } from '../types';
import { MINI_GAMES } from '../constants';

interface StealModalProps {
  isOpen: boolean;
  challengerTeamName: string;
  challengerColor: string;
  challengerTextColor: string;
  defenderTeamName: string;
  defenderColor: string;
  defenderTextColor: string;
  onResult: (challengerWon: boolean) => void;
  onClose: () => void;
}

const StealModal: React.FC<StealModalProps> = ({ 
  isOpen, 
  challengerTeamName,
  challengerColor,
  challengerTextColor,
  defenderTeamName,
  defenderColor,
  defenderTextColor,
  onResult 
}) => {
  const [selectedGame, setSelectedGame] = useState<MiniGame | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSpinning(true);
      setSelectedGame(null);
      
      // Simple random selection effect
      let count = 0;
      const interval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * MINI_GAMES.length);
        setSelectedGame(MINI_GAMES[randomIndex]);
        count++;
        if (count > 10) {
          clearInterval(interval);
          setIsSpinning(false);
        }
      }, 150);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border-4 border-black w-full max-w-lg shadow-[15px_15px_0px_0px_#000000]">
        {/* Header */}
        <div className="bg-black p-4 text-center border-b-4 border-black relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')]"></div>
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase relative z-10 animate-pulse">
            STEAL BATTLE
          </h2>
          <p className="text-white mt-1 text-sm font-bold relative z-10 flex items-center justify-center gap-2">
            <span className={challengerColor.replace('bg-', 'text-')}>{challengerTeamName}</span> 
            <span className="text-white/60">vs</span> 
            <span className={defenderColor.replace('bg-', 'text-')}>{defenderTeamName}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <div className="mb-6">
            <p className="text-sm font-bold text-gray-500 mb-2">BATTLE MISSION</p>
            <div className={`text-2xl font-black text-black border-4 border-black p-6 bg-yellow-50 transition-all ${isSpinning ? 'opacity-50 blur-sm' : 'opacity-100'}`}>
              {selectedGame ? selectedGame.title : 'CHOOSING...'}
            </div>
            {selectedGame && !isSpinning && (
              <p className="mt-2 text-sm font-bold text-gray-600 bg-gray-100 p-2 inline-block border-2 border-gray-300">
                {selectedGame.description}
              </p>
            )}
          </div>

          {!isSpinning && (
            <div className="flex flex-col gap-3">
              <p className="font-bold text-black mb-2 animate-bounce">승자를 선택하세요!</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => onResult(true)}
                  className={`flex-1 py-4 ${challengerColor} ${challengerTextColor} border-4 border-black font-black text-lg hover:brightness-110 transition-all shadow-[4px_4px_0px_0px_#000000] active:translate-y-1 active:shadow-none`}
                >
                  {challengerTeamName} 승리!
                  <div className="text-xs font-normal opacity-80 mt-1">(스틸 성공)</div>
                </button>
                <button 
                  onClick={() => onResult(false)}
                  className={`flex-1 py-4 ${defenderColor} ${defenderTextColor} border-4 border-black font-black text-lg hover:brightness-110 transition-all shadow-[4px_4px_0px_0px_#000000] active:translate-y-1 active:shadow-none`}
                >
                  {defenderTeamName} 승리!
                  <div className="text-xs font-normal opacity-80 mt-1">(방어 성공)</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StealModal;
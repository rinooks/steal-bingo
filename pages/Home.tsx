import React from 'react';
import Footer from '../components/Footer';

const Home: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const Card = ({ emoji, title, sub, onClick, accent }: any) => (
    <button
      onClick={onClick}
      className={`group text-left bg-white border-4 border-black p-6 shadow-neo hover:translate-y-1 hover:shadow-neo-hover transition-all active:translate-y-2 active:shadow-none`}
    >
      <div className={`text-4xl mb-3 inline-block px-3 py-1 border-4 border-black ${accent}`}>{emoji}</div>
      <h3 className="text-2xl font-black tracking-tighter">{title}</h3>
      <p className="text-sm font-bold text-gray-600 mt-1 break-keep">{sub}</p>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter">
            STEAL BINGO <span className="text-[#00E676] bg-black px-2">PRO</span>
          </h1>
          <p className="text-gray-600 mt-3 font-mono text-sm font-bold">CORPORATE EDUCATION SOLUTION · REFERENCE HRD</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <Card
            emoji="🖥️"
            title="로컬 게임"
            sub="한 화면에서 팀이 번갈아 진행 (강의실 프로젝터용)"
            accent="bg-[#FFD700]"
            onClick={() => navigate('/local')}
          />
          <Card
            emoji="🌐"
            title="온라인 멀티"
            sub="여러 기기로 접속해 조별/개인 실시간 대결"
            accent="bg-[#00E5FF]"
            onClick={() => navigate('/play')}
          />
          <Card
            emoji="🛠️"
            title="문제 관리자"
            sub="문제 출제·등록·수정·삭제 (서버 영구 저장)"
            accent="bg-[#FF9100]"
            onClick={() => navigate('/admin')}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Home;

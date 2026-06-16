import React, { useEffect, useState, useCallback } from 'react';
import Home from './pages/Home';
import LocalGame from './pages/LocalGame';
import Admin from './pages/Admin';
import OnlinePlay from './pages/OnlinePlay';

// 의존성 없는 간단한 해시 라우터 (#/local, #/admin, #/play)
function useHashRoute(): [string, (path: string) => void] {
  const get = () => (window.location.hash.replace(/^#/, '') || '/');
  const [path, setPath] = useState(get);

  useEffect(() => {
    const onChange = () => setPath(get());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return [path, navigate];
}

const App: React.FC = () => {
  const [path, navigate] = useHashRoute();

  if (path.startsWith('/local')) return <LocalGame onExit={() => navigate('/')} />;
  if (path.startsWith('/admin')) return <Admin navigate={navigate} />;
  if (path.startsWith('/play')) return <OnlinePlay navigate={navigate} />;
  return <Home navigate={navigate} />;
};

export default App;

import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 w-full py-4 bg-white border-t-4 border-black z-50">
      <div className="text-center">
        <p className="text-black font-bold text-sm tracking-widest uppercase">
          © 2026 REFERENCE HRD. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
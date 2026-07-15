import React from 'react';

export const CloudSyncLoadingView: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black select-none" dir="rtl">
      <style>{`
        @keyframes fillUp {
          0% {
            clip-path: inset(100% 0 0 0);
          }
          100% {
            clip-path: inset(0% 0 0 0);
          }
        }
        .liquid-fill {
          clip-path: inset(100% 0 0 0);
          animation: fillUp 2s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
        }
      `}</style>

      {/* SVG designed to perfectly match /public/icon.svg structure and coordinates */}
      <svg 
        viewBox="0 0 512 512" 
        className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] md:w-[360px] md:h-[360px] select-none"
      >
        {/* Background Text (Empty/Muted) */}
        <text 
          x="50%" 
          y="235" 
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          fontWeight="900" 
          fontSize="200" 
          fill="#1c1917" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          letterSpacing="2"
        >
          RQ
        </text>
        
        {/* Foreground Text (Filling Up) */}
        <text 
          x="50%" 
          y="235" 
          className="liquid-fill"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          fontWeight="900" 
          fontSize="200" 
          fill="#ffffff" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          letterSpacing="2"
        >
          RQ
        </text>
        
        {/* Subtitle */}
        <text 
          x="50%" 
          y="355" 
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          fontWeight="800" 
          fontSize="34" 
          fill="#52525b" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          letterSpacing="18"
        >
          SYSTEM
        </text>
        
        {/* Sleek emerald brand accent line */}
        <rect x="190" y="415" width="132" height="8" rx="4" fill="#10b981" />
      </svg>
    </div>
  );
};




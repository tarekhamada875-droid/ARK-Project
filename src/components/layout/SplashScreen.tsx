import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'closed' | 'opening' | 'finished'>('closed');

  useEffect(() => {
    // Hold closed state briefly (500ms) so user sees icon intact
    const openTimer = setTimeout(() => {
      setStage('opening');
    }, 500);

    // Complete splash after door opening animation finishes
    const finishTimer = setTimeout(() => {
      setStage('finished');
      if (onComplete) onComplete();
    }, 1500);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  if (stage === 'finished') return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] pointer-events-none select-none overflow-hidden bg-transparent">
        {/* Left Door Panel */}
        <motion.div
          className="absolute top-0 bottom-0 left-0 w-1/2 bg-[#0a0a0c] flex items-center justify-end shadow-2xl border-r border-white/30"
          initial={{ x: 0 }}
          animate={{ x: stage === 'opening' ? '-100%' : 0 }}
          transition={{
            duration: 0.95,
            ease: [0.76, 0, 0.24, 1], // Smooth cinematic door opening curve
          }}
        >
          {/* Left Half of Icon */}
          <div className="w-32 h-64 sm:w-40 sm:h-80 md:w-48 md:h-96 relative translate-x-[3px]">
            <svg
              viewBox="0 0 256 512"
              className="w-full h-full drop-shadow-[0_0_20px_rgba(206,17,38,0.4)]"
            >
              <defs>
                <clipPath id="leftClip">
                  <rect width="512" height="512" rx="112" ry="112" />
                </clipPath>
              </defs>
              <g clipPath="url(#leftClip)">
                {/* Top-Left Quadrant: Red */}
                <rect x="0" y="0" width="256" height="256" fill="#ce1126" />
                {/* Bottom-Left Quadrant: Black */}
                <rect x="0" y="256" width="256" height="256" fill="#0a0a0c" />
                {/* Horizontal White Line */}
                <line x1="0" y1="256" x2="256" y2="256" stroke="#ffffff" strokeWidth="8" />
              </g>
              {/* Vertical Middle White Line (Left Door Edge) */}
              <line x1="256" y1="0" x2="256" y2="512" stroke="#ffffff" strokeWidth="8" />
              {/* Outer Rim */}
              <rect x="2" y="2" width="508" height="508" fill="none" stroke="#27272a" strokeWidth="4" rx="110" opacity="0.4" />
            </svg>
          </div>
        </motion.div>

        {/* Right Door Panel */}
        <motion.div
          className="absolute top-0 bottom-0 right-0 w-1/2 bg-[#0a0a0c] flex items-center justify-start shadow-2xl border-l border-white/30"
          initial={{ x: 0 }}
          animate={{ x: stage === 'opening' ? '100%' : 0 }}
          transition={{
            duration: 0.95,
            ease: [0.76, 0, 0.24, 1],
          }}
        >
          {/* Right Half of Icon */}
          <div className="w-32 h-64 sm:w-40 sm:h-80 md:w-48 md:h-96 relative -translate-x-[3px]">
            <svg
              viewBox="256 0 256 512"
              className="w-full h-full drop-shadow-[0_0_20px_rgba(206,17,38,0.4)]"
            >
              <defs>
                <clipPath id="rightClip">
                  <rect width="512" height="512" rx="112" ry="112" />
                </clipPath>
              </defs>
              <g clipPath="url(#rightClip)">
                {/* Top-Right Quadrant: Black */}
                <rect x="256" y="0" width="256" height="256" fill="#0a0a0c" />
                {/* Bottom-Right Quadrant: Red */}
                <rect x="256" y="256" width="256" height="256" fill="#ce1126" />
                {/* Horizontal White Line */}
                <line x1="256" y1="256" x2="512" y2="256" stroke="#ffffff" strokeWidth="8" />
              </g>
              {/* Vertical Middle White Line (Right Door Edge) */}
              <line x1="256" y1="0" x2="256" y2="512" stroke="#ffffff" strokeWidth="8" />
              {/* Outer Rim */}
              <rect x="2" y="2" width="508" height="508" fill="none" stroke="#27272a" strokeWidth="4" rx="110" opacity="0.4" />
            </svg>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

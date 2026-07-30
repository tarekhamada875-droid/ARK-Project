import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'closed' | 'opening' | 'finished'>('closed');

  useEffect(() => {
    // Brief hold (250ms) so icon seamlessly matches initial render before sliding open
    const openTimer = setTimeout(() => {
      setStage('opening');
    }, 250);

    // Complete splash after door opening animation finishes
    const finishTimer = setTimeout(() => {
      setStage('finished');
      if (onComplete) onComplete();
    }, 1200);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  if (stage === 'finished') return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] pointer-events-none select-none overflow-hidden bg-black">
        {/* Left Door Panel */}
        <motion.div
          className="absolute top-0 bottom-0 left-0 w-1/2 bg-black flex items-center justify-end"
          initial={{ x: 0 }}
          animate={{ x: stage === 'opening' ? '-100%' : 0 }}
          transition={{
            duration: 0.8,
            ease: [0.77, 0, 0.175, 1], // Smooth elevator door easing
          }}
        >
          {/* Left Half of Icon */}
          <div className="w-28 h-56 sm:w-36 sm:h-72 md:w-44 md:h-88 relative">
            <svg
              viewBox="0 0 256 512"
              className="w-full h-full block"
              preserveAspectRatio="xMinYMid meet"
            >
              <defs>
                <clipPath id="leftIconClip">
                  <rect width="512" height="512" rx="112" ry="112" />
                </clipPath>
              </defs>
              <g clipPath="url(#leftIconClip)">
                {/* Top-Left Quadrant: Red */}
                <rect x="0" y="0" width="256" height="256" fill="#ce1126" />

                {/* Bottom-Left Quadrant: Black */}
                <rect x="0" y="256" width="256" height="256" fill="#0a0a0c" />

                {/* Horizontal Center Divider */}
                <line x1="0" y1="256" x2="256" y2="256" stroke="#ffffff" strokeWidth="6" />

                {/* Vertical Center Divider (Left half of line) */}
                <line x1="256" y1="0" x2="256" y2="512" stroke="#ffffff" strokeWidth="6" />
              </g>

              {/* Outer Rim Accent (Left Side) */}
              <rect x="2" y="2" width="508" height="508" fill="none" stroke="#27272a" strokeWidth="4" rx="110" opacity="0.4" clipPath="url(#leftIconClip)" />
            </svg>
          </div>
        </motion.div>

        {/* Right Door Panel */}
        <motion.div
          className="absolute top-0 bottom-0 right-0 w-1/2 bg-black flex items-center justify-start"
          initial={{ x: 0 }}
          animate={{ x: stage === 'opening' ? '100%' : 0 }}
          transition={{
            duration: 0.8,
            ease: [0.77, 0, 0.175, 1],
          }}
        >
          {/* Right Half of Icon */}
          <div className="w-28 h-56 sm:w-36 sm:h-72 md:w-44 md:h-88 relative">
            <svg
              viewBox="256 0 256 512"
              className="w-full h-full block"
              preserveAspectRatio="xMaxYMid meet"
            >
              <defs>
                <clipPath id="rightIconClip">
                  <rect width="512" height="512" rx="112" ry="112" />
                </clipPath>
              </defs>
              <g clipPath="url(#rightIconClip)">
                {/* Top-Right Quadrant: Black */}
                <rect x="256" y="0" width="256" height="256" fill="#0a0a0c" />

                {/* Bottom-Right Quadrant: Red */}
                <rect x="256" y="256" width="256" height="256" fill="#ce1126" />

                {/* Horizontal Center Divider */}
                <line x1="256" y1="256" x2="512" y2="256" stroke="#ffffff" strokeWidth="6" />

                {/* Vertical Center Divider (Right half of line) */}
                <line x1="256" y1="0" x2="256" y2="512" stroke="#ffffff" strokeWidth="6" />
              </g>

              {/* Outer Rim Accent (Right Side) */}
              <rect x="2" y="2" width="508" height="508" fill="none" stroke="#27272a" strokeWidth="4" rx="110" opacity="0.4" clipPath="url(#rightIconClip)" />
            </svg>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

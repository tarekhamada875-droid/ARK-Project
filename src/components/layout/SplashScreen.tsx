import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState<'closed' | 'shooting' | 'opening' | 'finished'>('closed');

  useEffect(() => {
    // 1. Hold steady icon briefly
    const shootTimer = setTimeout(() => {
      setStage('shooting');
    }, 200);

    // 2. Start door split after beam reaches screen top & bottom
    const openTimer = setTimeout(() => {
      setStage('opening');
    }, 600);

    // 3. Complete splash after door opening finishes
    const finishTimer = setTimeout(() => {
      setStage('finished');
      if (onComplete) onComplete();
    }, 1450);

    return () => {
      clearTimeout(shootTimer);
      clearTimeout(openTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  if (stage === 'finished') return null;

  // Single source of truth for the Icon SVG
  const renderIcon = (clipId: string) => (
    <svg
      viewBox="0 0 512 512"
      className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 block drop-shadow-[0_0_25px_rgba(206,17,38,0.25)]"
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="512" height="512" rx="112" ry="112" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Top-Left Quadrant: Red */}
        <rect x="0" y="0" width="256" height="256" fill="#ce1126" />

        {/* Bottom-Left Quadrant: Black */}
        <rect x="0" y="256" width="256" height="256" fill="#0a0a0c" />

        {/* Top-Right Quadrant: Black */}
        <rect x="256" y="0" width="256" height="256" fill="#0a0a0c" />

        {/* Bottom-Right Quadrant: Red */}
        <rect x="256" y="256" width="256" height="256" fill="#ce1126" />

        {/* Vertical Center Divider (White) */}
        <line x1="256" y1="0" x2="256" y2="512" stroke="#ffffff" strokeWidth="6" />

        {/* Horizontal Center Divider (White) */}
        <line x1="0" y1="256" x2="512" y2="256" stroke="#ffffff" strokeWidth="6" />
      </g>

      {/* Outer Rim Accent */}
      <rect
        x="2"
        y="2"
        width="508"
        height="508"
        fill="none"
        stroke="#27272a"
        strokeWidth="4"
        rx="110"
        opacity="0.4"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] pointer-events-none select-none overflow-hidden bg-black">
        {/* Left Door Panel */}
        <motion.div
          className="absolute top-0 bottom-0 left-0 w-1/2 bg-black overflow-hidden"
          initial={{ x: 0 }}
          animate={{ x: stage === 'opening' ? '-100%' : 0 }}
          transition={{
            duration: 0.85,
            ease: [0.77, 0, 0.175, 1], // Smooth elevator door easing
          }}
        >
          {/* Icon Half (Positioned relative to full screen width 100vw) */}
          <div className="absolute top-0 bottom-0 left-0 w-[100vw] flex items-center justify-center">
            {renderIcon('splashIconClipLeft')}
          </div>

          {/* Top Shooting Laser Beam (Left Half of center line) */}
          <motion.div
            className="absolute right-0 top-0 w-[1.5px] bg-white shadow-[0_0_10px_#ffffff]"
            style={{
              height: 'calc(50vh - 8rem)', // Matches top edge of 64/80/96 icon
              transformOrigin: 'bottom',
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: stage === 'shooting' || stage === 'opening' ? 1 : 0 }}
            transition={{
              duration: 0.35,
              ease: 'easeOut',
            }}
          />

          {/* Bottom Shooting Laser Beam (Left Half of center line) */}
          <motion.div
            className="absolute right-0 bottom-0 w-[1.5px] bg-white shadow-[0_0_10px_#ffffff]"
            style={{
              height: 'calc(50vh - 8rem)', // Matches bottom edge of 64/80/96 icon
              transformOrigin: 'top',
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: stage === 'shooting' || stage === 'opening' ? 1 : 0 }}
            transition={{
              duration: 0.35,
              ease: 'easeOut',
            }}
          />
        </motion.div>

        {/* Right Door Panel */}
        <motion.div
          className="absolute top-0 bottom-0 right-0 w-1/2 bg-black overflow-hidden"
          initial={{ x: 0 }}
          animate={{ x: stage === 'opening' ? '100%' : 0 }}
          transition={{
            duration: 0.85,
            ease: [0.77, 0, 0.175, 1],
          }}
        >
          {/* Icon Half (Positioned relative to full screen width 100vw) */}
          <div className="absolute top-0 bottom-0 right-0 w-[100vw] flex items-center justify-center">
            {renderIcon('splashIconClipRight')}
          </div>

          {/* Top Shooting Laser Beam (Right Half of center line) */}
          <motion.div
            className="absolute left-0 top-0 w-[1.5px] bg-white shadow-[0_0_10px_#ffffff]"
            style={{
              height: 'calc(50vh - 8rem)',
              transformOrigin: 'bottom',
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: stage === 'shooting' || stage === 'opening' ? 1 : 0 }}
            transition={{
              duration: 0.35,
              ease: 'easeOut',
            }}
          />

          {/* Bottom Shooting Laser Beam (Right Half of center line) */}
          <motion.div
            className="absolute left-0 bottom-0 w-[1.5px] bg-white shadow-[0_0_10px_#ffffff]"
            style={{
              height: 'calc(50vh - 8rem)',
              transformOrigin: 'top',
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: stage === 'shooting' || stage === 'opening' ? 1 : 0 }}
            transition={{
              duration: 0.35,
              ease: 'easeOut',
            }}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

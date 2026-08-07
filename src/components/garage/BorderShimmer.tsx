import React, { memo } from 'react';

interface BorderShimmerProps {
  isActive: boolean;
  rx?: number;
  ry?: number;
  color?: string;
}

export const BorderShimmer: React.FC<BorderShimmerProps> = memo(({ isActive, rx = 28, ry = 28, color = '#10b981' }) => {
  if (!isActive) return null;

  // Stable unique ID for SVG gradient definitions
  const uId = React.useId().replace(/:/g, '');

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-10 rounded-[inherit] overflow-hidden"
      style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden', willChange: 'transform' }}
    >
      <svg 
        className="absolute inset-0 w-full h-full" 
        style={{ overflow: 'visible', transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
      >
        <defs>
          <linearGradient 
            id={`shimmerGrad-${uId}`} 
            x1="0%" 
            y1="-100%" 
            x2="0%" 
            y2="100%"
          >
            <animate
              attributeName="y1"
              from="-100%"
              to="100%"
              dur="4.0s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y2"
              from="0%"
              to="200%"
              dur="4.0s"
              repeatCount="indefinite"
            />
            {/* Soft, rich metallic sheen sweep */}
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="35%" stopColor={color} stopOpacity="0.2" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="65%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Soft, outer ambient glow simulation (No expensive blur filter used for ultimate mobile performance) */}
        <rect
          x="1"
          y="1"
          style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={`url(#shimmerGrad-${uId})`}
          strokeWidth="8"
          className="opacity-15"
        />
        {/* Mid-level glow halo */}
        <rect
          x="1"
          y="1"
          style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={`url(#shimmerGrad-${uId})`}
          strokeWidth="4.5"
          className="opacity-35"
        />
        {/* Sharp shining overlay */}
        <rect
          x="1"
          y="1"
          style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={`url(#shimmerGrad-${uId})`}
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
});

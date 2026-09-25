import React from 'react';

// Subtle waves anchored to the bottom corners of the panel
const WavePattern = () => (
  <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full" viewBox="0 0 1200 140" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 84c150 0 250-44 420-34s250 60 420 44 300-38 360-38v84H0z" fill="#EADFCF" opacity="0.4" />
    <path d="M0 108c180 0 300-38 480-30s260 46 420 32 240-24 300-24v54H0z" fill="#EADFCF" opacity="0.7" />
  </svg>
);

// Four-pointed sparkle, drawn rather than imported so it can be sized freely
const Sparkle = ({ className, size = 14 }) => (
  <svg className={`pointer-events-none absolute ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 0c.7 6.3 5 10.6 12 12-7 1.4-11.3 5.7-12 12-.7-6.3-5-10.6-12-12C7 10.6 11.3 6.3 12 0z" fill="#EADFCF" />
  </svg>
);

// Warm empty state shared by the estimates panels: soft icon tile, sparkles and waves.
// The tile is 112px with a 48px glyph, which is the proportion the reference design uses -- the
// panel reads as deliberately empty rather than as a small message lost in a large card.
const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`relative overflow-hidden px-6 py-16 text-center ${className}`}>
    <WavePattern />
    <div className="relative">
      <div className="relative mx-auto mb-6 h-28 w-28">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-warm-accent-soft">
          {Icon && <Icon className="h-12 w-12 text-warm-accent" strokeWidth={1.5} />}
        </div>
        <Sparkle className="-right-1 top-2" size={18} />
        <Sparkle className="right-4 -top-3" size={11} />
        <Sparkle className="-left-3 bottom-5" size={14} />
      </div>
      <p className="text-lg font-semibold text-warm-text">{title}</p>
      {description && <p className="mt-1.5 text-sm text-warm-muted">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  </div>
);

export default EmptyState;

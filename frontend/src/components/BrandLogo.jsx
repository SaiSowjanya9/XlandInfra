const BrandLogo = ({
  size = 'default',
  className = '',
  showText = true
}) => {
  const sizes = {
    xs: { logo: 'h-8', text: 'text-sm', subtext: 'text-[6px]', line: 'w-4', gap: 'gap-2' },
    sm: { logo: 'h-10', text: 'text-base', subtext: 'text-[7px]', line: 'w-6', gap: 'gap-2' },
    default: { logo: 'h-12 md:h-14', text: 'text-lg md:text-xl', subtext: 'text-[8px]', line: 'w-8', gap: 'gap-3' },
    lg: { logo: 'h-14 md:h-16', text: 'text-xl md:text-2xl', subtext: 'text-[9px]', line: 'w-10', gap: 'gap-3' },
    xl: { logo: 'h-16 md:h-18', text: 'text-xl md:text-2xl', subtext: 'text-[9px]', line: 'w-10', gap: 'gap-4' },
  };

  const s = sizes[size] || sizes.default;

  if (!showText) {
    return (
      <img
        src="/XLAND_INFRA_Website.png"
        alt="XLAND INFRA"
        className={`${s.logo} w-auto ${className}`}
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />
    );
  }

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <img
        src="/XLAND_INFRA_Website.png"
        alt="XLAND INFRA"
        className={`${s.logo} w-auto`}
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />
      <div className="flex flex-col items-center leading-none">
        <span className={`${s.text} font-bold tracking-[0.15em] text-gold-shine`}>
          XLAND INFRA
        </span>
        <div className="flex items-center gap-2 mt-1">
          <div className={`${s.line} h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-amber-400`}></div>
          <span className={`${s.subtext} text-gold-subtle tracking-[0.25em] uppercase font-medium`}>
            PVT LTD
          </span>
          <div className={`${s.line} h-[1px] bg-gradient-to-l from-transparent via-amber-500 to-amber-400`}></div>
        </div>
      </div>
    </div>
  );
};

export default BrandLogo;

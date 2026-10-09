const BrandLogo = ({
  size = 'default',
  className = '',
  showText = true,
  variant = 'default'
}) => {
  // variant 'contract' swaps in the contract-edition logo used across the customer
  // portal; the public website keeps the default mark.
  const contract = variant === 'contract';
  const img = (cls) => contract ? (
    <img
      src="/logo-contract.png"
      alt="XLAND INFRA"
      className={cls}
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  ) : (
    <picture>
      <source srcSet="/logo.webp" type="image/webp" />
      <img
        src="/logo.png"
        alt="XLAND INFRA"
        className={cls}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </picture>
  );

  const sizes = {
    xs: { logo: 'h-8', text: 'text-sm', subtext: 'text-[6px]', line: 'w-4', gap: 'gap-2' },
    sm: { logo: 'h-10', text: 'text-base', subtext: 'text-[7px]', line: 'w-6', gap: 'gap-2' },
    default: { logo: 'h-12 md:h-14', text: 'text-lg md:text-xl', subtext: 'text-[8px]', line: 'w-8', gap: 'gap-3' },
    lg: { logo: 'h-14 md:h-16', text: 'text-xl md:text-2xl', subtext: 'text-[9px]', line: 'w-10', gap: 'gap-3' },
    xl: { logo: 'h-16 md:h-18', text: 'text-xl md:text-2xl', subtext: 'text-[9px]', line: 'w-10', gap: 'gap-4' },
  };

  const s = sizes[size] || sizes.default;

  if (!showText) {
    return img(`${s.logo} w-auto ${className}`);
  }

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      {img(`${s.logo} w-auto`)}
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

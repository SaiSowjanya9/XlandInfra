import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';
import { formatCurrency } from '../../utils/estimatePackageUtils';

export default function EstimateProfitSummaryPanel({
  vendorCost,
  operatingCost,
  actualCost,
  customerPrice,
  profit,
  marginPercent,
  className = '',
  theme,
  title = 'Internal Profit Summary'
}) {
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);

  const rows = [
    ['Annual Vendor Cost', vendorCost],
    operatingCost != null && ['XLAND Operating Cost', operatingCost],
    actualCost != null && ['Total Actual Cost', actualCost],
    ['Customer Price', customerPrice],
    ['Gross Profit', profit],
    ['Gross Margin', marginPercent == null ? null : `${marginPercent}%`]
  ].filter(Boolean);

  return (
    <section className={`rounded-xl border ${skin.border} bg-white p-5 ${className}`}>
      <h2 className={`mb-1 text-sm font-semibold ${skin.strong}`}>{title}</h2>
      <p className={`mb-4 text-[11px] ${skin.muted}`}>For internal use only</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {rows.map(([label, value]) => (
          <div key={label} className={`min-w-0 rounded-lg border ${skin.borderSoft} bg-white px-3 py-2.5`}>
            <dt className={`truncate text-[11px] ${skin.muted}`} title={label}>{label}</dt>
            <dd className={`mt-1 truncate text-sm font-bold tabular-nums ${skin.strong}`} title={value}>
              {typeof value === 'number' ? formatCurrency(value) : (value ?? '—')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

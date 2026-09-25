import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';

// How an estimate is put together: a pre-built AMC package, or services entered one by one.
// Every portal's create form shows the same two choices in the same place, so the decision is made
// before anything is priced. The package dropdown stays with the host page — each portal filters
// packages its own way — and is passed in as children so it sits on this row when it applies.
const OPTIONS = [
  { value: 'package', title: 'Select AMC Package', hint: 'Choose a pre-built AMC package and customize' },
  { value: 'custom', title: 'Build Custom Services', hint: 'Add individual services as per requirement' }
];

export default function EstimateStructure({ value, onChange, name = 'estimateStructure', theme, children }) {
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  return (
    <div className={`rounded-xl border p-4 ${skin.panel}`}>
      <h3 className={`text-sm font-semibold mb-3 ${skin.heading}`}>Estimate Structure</h3>
      {/* The two tiles keep one width and height between them, so neither reads as the bigger choice */}
      <div className="flex flex-wrap items-stretch gap-3">
        {OPTIONS.map(option => {
          const active = value === option.value;
          return (
            <label key={option.value}
              className={`flex min-w-[240px] flex-1 max-w-sm cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${active
                ? skin.tileActive : skin.tileIdle}`}>
              <input type="radio" name={name} value={option.value} checked={active}
                onChange={() => onChange(option.value)} className={`mt-0.5 h-4 w-4 ${skin.control}`} />
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${active ? skin.tileActiveText : skin.text}`}>{option.title}</span>
                <span className={`mt-0.5 block text-xs ${skin.muted}`}>{option.hint}</span>
              </span>
            </label>
          );
        })}
        {children && <div className="flex min-w-[260px] flex-[2] items-center">{children}</div>}
      </div>
    </div>
  );
}

import { findManpowerRange, isVisitManpower, manpowerRangeLabel } from '../../utils/manpowerPricing';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';

const fieldClass = skin => `mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm ${skin.fieldSoft} ${skin.disabledField}`;

export default function ManpowerFields({ service, inputs, onChange, theme }) {
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  if (!isVisitManpower(service)) return null;
  const inputClass = fieldClass(skin);
  const labelClass = `block text-xs font-semibold ${skin.label}`;
  const range = findManpowerRange(service.manpower_ranges, inputs.area);
  return <>
    {service.manpower_ranges?.length > 0 && <label className={labelClass}>
      Property Area (Sq Ft) *
      <input type="number" min="1" max={1e9} step="1" value={inputs.area ?? ''} onChange={event => onChange('area', event.target.value)} className={inputClass} />
      <span className={`mt-1 block text-xs font-normal ${skin.muted}`}>{range ? `${manpowerRangeLabel(range)}: recommended ${range.recommendedMin}–${range.recommendedMax} persons` : 'Enter area to select the manpower range.'}</span>
    </label>}
    <label className={labelClass}>
      Included Hours per Person / Visit
      <input readOnly value={service.working_hours_per_visit} className={`${inputClass} ${skin.readOnlyBg}`} />
    </label>
    {service.overtime_rate_per_hour != null && <label className={labelClass}>
      Overtime Hours per Person / Visit
      <input type="number" min="0" max={24 - Number(service.working_hours_per_visit)} step="0.01" value={inputs.overtime_hours_per_visit ?? 0} onChange={event => onChange('overtime_hours_per_visit', event.target.value)} className={inputClass} />
    </label>}
    {/* Spans whatever grid hosts it: three columns in the custom builder, two in the picker dialog */}
    {service.role_designation && <p className={`text-xs sm:col-span-full ${skin.muted}`}>Role / Designation: {service.role_designation}</p>}
  </>;
}

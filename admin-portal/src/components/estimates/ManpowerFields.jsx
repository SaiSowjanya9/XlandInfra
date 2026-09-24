import { findManpowerRange, isVisitManpower, manpowerRangeLabel } from '../../utils/manpowerPricing';

const inputClass = 'mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 disabled:bg-slate-50';

export default function ManpowerFields({ service, inputs, onChange }) {
  if (!isVisitManpower(service)) return null;
  const range = findManpowerRange(service.manpower_ranges, inputs.area);
  return <>
    {service.manpower_ranges?.length > 0 && <label className="block text-xs font-semibold text-slate-600">
      Property Area (Sq Ft) *
      <input type="number" min="1" max={1e9} step="1" value={inputs.area ?? ''} onChange={event => onChange('area', event.target.value)} className={inputClass} />
      <span className="mt-1 block text-xs font-normal text-slate-500">{range ? `${manpowerRangeLabel(range)}: recommended ${range.recommendedMin}–${range.recommendedMax} persons` : 'Enter area to select the manpower range.'}</span>
    </label>}
    <label className="block text-xs font-semibold text-slate-600">
      Included Hours per Person / Visit
      <input readOnly value={service.working_hours_per_visit} className={`${inputClass} bg-slate-50`} />
    </label>
    {service.overtime_rate_per_hour != null && <label className="block text-xs font-semibold text-slate-600">
      Overtime Hours per Person / Visit
      <input type="number" min="0" max={24 - Number(service.working_hours_per_visit)} step="0.01" value={inputs.overtime_hours_per_visit ?? 0} onChange={event => onChange('overtime_hours_per_visit', event.target.value)} className={inputClass} />
    </label>}
    {/* Spans whatever grid hosts it: three columns in the custom builder, two in the picker dialog */}
    {service.role_designation && <p className="text-xs text-slate-500 sm:col-span-full">Role / Designation: {service.role_designation}</p>}
  </>;
}

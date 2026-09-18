export const isVisitManpower = service => service?.pricing_method === 'manpower' && service.manpower_basis === 'per_visit';

export const findManpowerRange = (ranges, area) => {
  if (area == null || String(area).trim() === '' || !Number.isInteger(Number(area)) || Number(area) < 1 || Number(area) > 1e9) return undefined;
  return ranges?.find(range => range.areaFrom !== '' && Number(area) >= Number(range.areaFrom) &&
    (range.areaTo === null || (range.areaTo !== '' && Number(area) <= Number(range.areaTo))));
};

export const suggestedManpower = (service, area) => Math.max(Number(service?.minimum_manpower) || 1,
  Number(findManpowerRange(service?.manpower_ranges, area)?.recommendedMin) || 1);

export const manpowerRangeLabel = range => range ? `${range.areaFrom}${range.areaTo === null ? '+' : `–${range.areaTo}`} Sq Ft` : '—';

export const previewManpower = (service, inputs) => {
  const valid = value => value != null && value !== '' && Number.isFinite(Number(value));
  const range = findManpowerRange(service.manpower_ranges, inputs.area);
  if (service.manpower_ranges?.length && !range) return { error: 'Enter a whole-number area within the configured manpower ranges.' };
  const rate = range?.ratePerPerson ?? service.rate_per_person;
  const personnel = inputs.personnel ?? suggestedManpower(service, inputs.area);
  const visits = service.default_visits_per_year;
  const hours = service.working_hours_per_visit;
  const overtime = inputs.overtime_hours_per_visit ?? 0;
  const markup = service.default_markup_percentage;
  if (!valid(rate) || Number(rate) < 0 || Number(rate) > 1e9 || !valid(markup) || Number(markup) < 0 || Number(markup) > 1000) return { error: 'Enter a valid rate and markup to preview pricing.' };
  if (!valid(service.minimum_manpower) || !Number.isInteger(Number(service.minimum_manpower)) || Number(service.minimum_manpower) < 1 ||
    !valid(personnel) || !Number.isInteger(Number(personnel)) || Number(personnel) < Number(service.minimum_manpower) || Number(personnel) > 1e6) return { error: `Enter a whole-number headcount of at least ${service.minimum_manpower || 1}.` };
  if (!valid(visits) || !Number.isInteger(Number(visits)) || Number(visits) < 1 || Number(visits) > 366 || !valid(hours) || Number(hours) <= 0 || Number(hours) > 24) return { error: 'Enter valid visits and working hours.' };
  if (service.overtime_rate_per_hour != null && (!valid(service.overtime_rate_per_hour) || Number(service.overtime_rate_per_hour) < 0 || Number(service.overtime_rate_per_hour) > 1e9)) return { error: 'Enter a valid overtime rate.' };
  if (!valid(overtime) || Number(overtime) < 0 || Number(overtime) > 24 - Number(hours) ||
    (Number(overtime) > 0 && !valid(service.overtime_rate_per_hour))) return { error: 'Enter valid overtime hours with a configured overtime rate.' };
  const vendorCost = Math.round((Number(personnel) * (Number(rate) + Number(overtime) * Number(service.overtime_rate_per_hour ?? 0)) * Number(visits) + Number.EPSILON) * 100) / 100;
  const operatingCost = Number(service.default_operating_cost ?? 0) || 0;
  const actualCost = Math.round((vendorCost + operatingCost + Number.EPSILON) * 100) / 100;
  const customerPrice = Math.round((actualCost * (1 + Number(markup) / 100) + Number.EPSILON) * 100) / 100;
  if (customerPrice > 999999999.99) return { error: 'Example price exceeds the supported limit.' };
  const marginPercentage = customerPrice ? Math.round(((customerPrice - actualCost) / customerPrice * 100 + Number.EPSILON) * 100) / 100 : 0;
  return { range, ratePerPerson: Number(rate), personnel: Number(personnel), vendorCost, operatingCost, actualCost, customerPrice, marginPercentage };
};

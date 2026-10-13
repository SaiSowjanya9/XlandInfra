import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatDate, toDateInputValue, maskTypedDate, parseTypedDate, toTypedDate, istTodayValue,
  DATE_PLACEHOLDER
} from '../../utils/dateFormat';

/**
 * A date field that always reads dd/mm/yyyy.
 *
 * `<input type="date">` cannot be made to do this: browsers take the display format from the
 * operating system's locale and ignore the `lang` attribute, so the same screen showed
 * dd/mm/yyyy in India and mm/dd/yyyy on a machine set to en-US. Only the *presentation* differs --
 * the value was always yyyy-mm-dd -- but a date field that reads 05/08/2026 to one colleague and
 * 08/05/2026 to another is worth replacing.
 *
 * It is a drop-in for the native input it replaces: the same `value` (yyyy-mm-dd), and `onChange`
 * is called with `{ target: { name, value } }` carrying yyyy-mm-dd, so every handler that was
 * written against the native input keeps working unchanged.
 *
 * Typing is masked to dd/mm/yyyy, and a date that does not exist is refused rather than rolled
 * forward -- `new Date('2026-02-31')` would silently become 3 March.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// The grid is built from plain local-midnight dates and only ever read back as y/m/d, so no
// timezone conversion is involved.
const monthGrid = (year, monthIndex) => {
  const first = new Date(year, monthIndex, 1);
  // Monday-first, like the rest of the product's calendars.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const valueOf = (year, monthIndex, day) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const DateField = ({
  value = '',
  onChange,
  name,
  id,
  min,
  max,
  required = false,
  disabled = false,
  readOnly = false,
  className = '',
  placeholder = DATE_PLACEHOLDER,
  title,
  autoFocus = false,
  onBlur,
  ...rest
}) => {
  const [text, setText] = useState(() => toTypedDate(value));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const start = toDateInputValue(value) || istTodayValue();
    return { year: Number(start.slice(0, 4)), month: Number(start.slice(5, 7)) - 1 };
  });
  const wrapRef = useRef(null);

  // A value changed by the page -- a reset, or a stage that stamps today's date -- has to show.
  useEffect(() => { setText(toTypedDate(value)); }, [value]);

  useEffect(() => {
    if (!open) return;
    const away = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const emit = (next) => {
    if (next === toDateInputValue(value)) return;
    onChange?.({ target: { name, value: next } });
  };

  const outOfRange = (candidate) => (
    (min && candidate < toDateInputValue(min)) || (max && candidate > toDateInputValue(max))
  );

  const handleType = (event) => {
    const masked = maskTypedDate(event.target.value);
    setText(masked);
    if (masked === '') {
      emit('');
      return;
    }
    const parsed = parseTypedDate(masked);
    // Only a complete, real date is published. Emitting on every keystroke would wipe the stored
    // value the moment somebody started editing it.
    if (parsed && !outOfRange(parsed)) emit(parsed);
  };

  // What is in the box when focus leaves has to agree with what is stored, or the field would show
  // a date the record does not have.
  const handleBlur = (event) => {
    const parsed = parseTypedDate(text);
    if (!text) emit('');
    else if (!parsed || outOfRange(parsed)) setText(toTypedDate(value));
    else setText(toTypedDate(parsed));
    onBlur?.(event);
  };

  const pick = (day) => {
    const picked = valueOf(view.year, view.month, day);
    if (outOfRange(picked)) return;
    setText(toTypedDate(picked));
    emit(picked);
    setOpen(false);
  };

  const shiftMonth = (by) => setView((current) => {
    const next = new Date(current.year, current.month + by, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  });

  const selected = toDateInputValue(value);
  const today = istTodayValue();
  const cells = useMemo(() => monthGrid(view.year, view.month), [view.year, view.month]);

  return (
    <span ref={wrapRef} className="relative inline-block w-full">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={handleType}
        onBlur={handleBlur}
        name={name}
        id={id}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        title={title || (selected ? formatDate(selected) : undefined)}
        autoFocus={autoFocus}
        maxLength={10}
        className={className}
        {...rest}
      />
      {!disabled && !readOnly && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (selected) {
              setView({ year: Number(selected.slice(0, 4)), month: Number(selected.slice(5, 7)) - 1 });
            }
            setOpen((wasOpen) => !wasOpen);
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Open calendar"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 right-0 w-[248px] rounded-xl border border-gray-200 bg-white shadow-lg p-2.5">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-gray-100" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-900">
              {MONTHS[view.month]} {view.year}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-gray-100" aria-label="Next month">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="text-[11px] text-gray-400 text-center py-0.5">{weekday}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />;
              const candidate = valueOf(view.year, view.month, day);
              const isSelected = candidate === selected;
              const isToday = candidate === today;
              const blocked = outOfRange(candidate);
              return (
                <button
                  key={candidate}
                  type="button"
                  disabled={blocked}
                  onClick={() => pick(day)}
                  className={`h-7 text-xs rounded-md transition-colors ${
                    isSelected
                      ? 'bg-[#B5812A] text-white font-semibold'
                      : blocked
                        ? 'text-gray-300 cursor-not-allowed'
                        : isToday
                          ? 'bg-[#F6EBD1] text-[#B5812A] font-semibold hover:bg-[#EADFCF]'
                          : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                if (outOfRange(today)) return;
                setText(toTypedDate(today));
                emit(today);
                setOpen(false);
              }}
              className="text-xs font-medium text-[#B5812A] hover:underline"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { setText(''); emit(''); setOpen(false); }}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </span>
  );
};

export default DateField;

import { forwardRef, useEffect, useRef } from 'react';

export function ReadOnlyPropertyValue({ value, placeholder = 'Auto-filled', className = '', ...props }) {
  return <div {...props} className={`block min-h-[42px] min-w-0 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 text-gray-900 whitespace-pre-wrap [overflow-wrap:anywhere] ${className}`}>
    {value === '' || value == null ? <span className="text-gray-400">{placeholder}</span> : String(value)}
  </div>;
}

export const EstimateInput = forwardRef(function EstimateInput({ readOnly, value, placeholder, className, ...props }, ref) {
  if (readOnly && ['text', 'email', 'tel'].includes(props.type || 'text')) return <ReadOnlyPropertyValue id={props.id} aria-label={props['aria-label']} value={value} placeholder={placeholder} className={className} />;
  return <input {...props} ref={ref} readOnly={readOnly} value={value} placeholder={placeholder} className={className} />;
});

export function PropertyIdInput({ value, onChange, onKeyDown, className = '', type, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    const resize = () => { field.style.height = 'auto'; field.style.height = `${field.scrollHeight + 2}px`; };
    resize();
    let width = field.clientWidth;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (field.clientWidth !== width) { width = field.clientWidth; resize(); }
    });
    observer?.observe(field);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [value]);
  return <textarea {...props} ref={ref} rows={1} value={value}
    onChange={event => { event.target.value = event.target.value.replace(/[\r\n]/g, ''); onChange?.(event); }}
    onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); onKeyDown?.(event); }}
    className={`block min-h-[42px] min-w-0 w-full resize-none overflow-hidden leading-6 [overflow-wrap:anywhere] ${className}`} />;
}

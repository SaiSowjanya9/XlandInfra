import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Loader2, Plus } from 'lucide-react';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';
import { capitalizeFirst } from '../../utils/text';

/**
 * AutocompleteInput - A reusable typeahead/autocomplete component
 * 
 * Props:
 * - value: Current input value
 * - onChange: Callback when value changes
 * - options: Array of strings or objects with 'label' and 'value' keys
 * - placeholder: Input placeholder text
 * - label: Label text (optional)
 * - required: Whether field is required
 * - disabled: Whether input is disabled
 * - allowCustom: Allow custom values not in the list (default: true)
 * - className: Additional CSS classes for container
 * - inputClassName: Additional CSS classes for input
 * - error: Error message to display
 * - onSelect: Callback when an option is selected from dropdown
 * - filterFn: Custom filter function (optional)
 * - renderOption: Custom option renderer (optional)
 * - maxResults: Maximum number of results to show (default: 10)
 * - showAllOnOpen: Opening the list with the arrow or on focus shows every option, like a plain
 *   select; typing then filters as usual (default: false)
 * - onCreateOption: async (name) => option | void. Given, a value that is not in the list yet is
 *   offered as a "Save" row at the top of the dropdown, with the same tick Enter commits. That is
 *   what puts a typed value in the list itself rather than only in this one field.
 * - onDeleteOption: async (option) => void. Given, every option marked `removable` carries a cross
 *   -- which is how a name typed by mistake leaves the list again. Only the caller knows which
 *   options may go, so nothing is assumed here.
 * - theme: 'warm' renders the beige estimate skin; anything else keeps the original slate/blue one
 * - capitalize: the first letter of what is typed is upper case (a picked option is left as listed)
 *
 * Leaving the field with a value that matches an option except for case or spacing selects that
 * option, so "lifts" typed beside a listed "Lifts" is saved as "Lifts" rather than as a second entry.
 */
const AutocompleteInput = ({
  value = '',
  onChange,
  options = [],
  placeholder = 'Type to search...',
  label,
  required = false,
  disabled = false,
  allowCustom = true,
  className = '',
  inputClassName = '',
  error,
  onSelect,
  filterFn,
  renderOption,
  maxResults = 10,
  showAllOnOpen = false,
  onCreateOption,
  onDeleteOption,
  id,
  theme,
  capitalize = false,
}) => {
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  const [isOpen, setIsOpen] = useState(false);
  // True while the list was opened without typing, so every option is listed
  const [browsing, setBrowsing] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // While the caller's save runs, and the value of the option its delete is running for
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);

  // Normalize options to { label, value } format
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Default filter function with fuzzy matching
  const defaultFilter = (option, query) => {
    if (!query) return true;
    const searchTerm = query.toLowerCase().trim();
    const optionLabel = option.label.toLowerCase();
    
    // Exact match at start
    if (optionLabel.startsWith(searchTerm)) return { match: true, score: 3 };
    
    // Contains match
    if (optionLabel.includes(searchTerm)) return { match: true, score: 2 };
    
    // Fuzzy match - check if all characters appear in order
    let searchIndex = 0;
    for (let i = 0; i < optionLabel.length && searchIndex < searchTerm.length; i++) {
      if (optionLabel[i] === searchTerm[searchIndex]) {
        searchIndex++;
      }
    }
    if (searchIndex === searchTerm.length) return { match: true, score: 1 };
    
    return { match: false, score: 0 };
  };

  // Filter and sort options
  const getFilteredOptions = () => {
    if (showAllOnOpen && browsing) return normalizedOptions.slice(0, maxResults);
    const filter = filterFn || defaultFilter;
    const results = normalizedOptions
      .map(opt => ({ ...opt, ...filter(opt, inputValue) }))
      .filter(opt => opt.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    return results;
  };

  const filteredOptions = getFilteredOptions();

  // The typed value is offered for saving only while it is genuinely new: the whole list is
  // checked, not the filtered slice, so a name the filter happened to hide is never added twice.
  const sameText = (first, second) => String(first ?? '').trim().replace(/\s+/g, ' ').toLowerCase() === String(second ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

  // A value typed to match a listed option in all but case or spacing becomes that option when the
  // field is left. Read from a ref, because the outside-click listener is registered only once.
  const latest = useRef({});
  latest.current = { inputValue, normalizedOptions, onChange, value, allowCustom, isOpen };
  const snapToOption = () => {
    const { inputValue: typed, normalizedOptions: listed, onChange: change, value: current, allowCustom: custom } = latest.current;
    if (!custom || !String(typed || '').trim()) return;
    const match = listed.find(option => sameText(option.label, typed));
    if (match && (match.value !== current || match.label !== typed)) {
      setInputValue(match.label);
      change?.(match.value);
    }
  };
  const offerCustom = Boolean(onCreateOption) && !disabled && inputValue.trim() !== '' &&
    !normalizedOptions.some(option => sameText(option.label, inputValue));

  // Saving takes the typed value into the list itself. What comes back is selected, so the field
  // ends up holding exactly what was saved -- with the caller's own spelling if it adjusted it.
  const busy = saving || deleting !== null;
  const handleCreate = async () => {
    const name = inputValue.trim();
    if (!name || busy) return;
    setSaving(true);
    setActionError('');
    try {
      const created = await onCreateOption(name);
      const label = (typeof created === 'string' ? created : created?.label ?? created?.name) || name;
      setInputValue(label);
      onChange?.(label);
      onSelect?.({ ...(typeof created === 'object' && created ? created : {}), label, value: label });
      setIsOpen(false);
      setHighlightedIndex(-1);
    } catch (error) {
      setActionError(error?.message || 'Could not save that value.');
    } finally {
      setSaving(false);
    }
  };

  // The cross is for a value typed by mistake, so a deleted option that is still in the box leaves
  // it empty rather than naming something the list no longer offers.
  const handleDelete = async (event, option) => {
    event.stopPropagation();
    if (busy) return;
    setDeleting(option.value);
    setActionError('');
    try {
      await onDeleteOption(option);
      if (sameText(option.value, value) || sameText(option.label, inputValue)) {
        setInputValue('');
        onChange?.('');
      }
      inputRef.current?.focus();
    } catch (error) {
      setActionError(error?.message || 'Could not delete that value.');
    } finally {
      setDeleting(null);
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        if (containerRef.current.contains(document.activeElement) || latest.current.isOpen) snapToOption();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = capitalize ? capitalizeFirst(e.target.value) : e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setBrowsing(false);
    setHighlightedIndex(-1);
    setActionError('');
    if (allowCustom) {
      onChange?.(newValue);
    }
  };

  // Handle option selection. The list closes on the pick and stays closed: the field is often inside
  // a <label> (the forms' Field wrapper), and a click on a plain option div activates that label,
  // which hands focus back to the input -- whose onFocus reopened the list at once, so it only
  // vanished on the next click elsewhere. The click's default is cancelled, so the label never
  // forwards it, and a focus that still arrives straight after a pick does not reopen.
  const justPicked = useRef(false);
  const handleSelect = (option, event) => {
    event?.preventDefault();
    justPicked.current = true;
    setTimeout(() => { justPicked.current = false; }, 0);
    setInputValue(option.label);
    onChange?.(option.value);
    onSelect?.(option);
    setIsOpen(false);
    setBrowsing(false);
    setHighlightedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && e.key === 'ArrowDown') {
      setIsOpen(true);
      setBrowsing(true);
      return;
    }

    // Enter commits whatever has been typed even with the list shut, and stops there. Returning
    // early let the key reach the form around the field, so pressing Enter after typing a new
    // category submitted the whole service form instead of accepting the word.
    if (!isOpen && e.key === 'Enter') {
      if (!allowCustom || !inputValue) return;
      e.preventDefault();
      if (offerCustom) return void handleCreate();
      onChange?.(inputValue);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter': {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
          break;
        }
        // Nothing is highlighted until the arrows are used, so Enter takes the word as typed --
        // unless the list holds that exact word, in which case it is the same choice either way
        const exact = filteredOptions.find(option => sameText(option.label, inputValue));
        if (exact) handleSelect(exact);
        // With somewhere to save it, Enter saves rather than only filling the field in
        else if (offerCustom) handleCreate();
        else if (allowCustom && inputValue) { onChange?.(inputValue); setIsOpen(false); }
        break;
      }
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        snapToOption();
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedEl = dropdownRef.current.children[highlightedIndex];
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Clear input
  const handleClear = () => {
    setInputValue('');
    onChange?.('');
    setBrowsing(true);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className={`block text-sm font-medium mb-1 ${skin.inputLabel}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => { if (justPicked.current) return; setIsOpen(true); setBrowsing(true); }}
          // A field still focused after a pick reopens on a click, rather than needing a key press
          onClick={() => { if (!disabled && !isOpen) { setIsOpen(true); setBrowsing(true); } }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-16 border rounded-lg text-sm transition-colors
            ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : `focus:ring-2 ${skin.inputField}`}
            ${disabled ? `${skin.disabledBg} cursor-not-allowed` : 'bg-white'}
            ${inputClassName}`}
          autoComplete="off"
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className={`p-1 rounded ${skin.faint} ${skin.iconMuted}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (disabled) return; setBrowsing(true); setIsOpen(!isOpen); }}
            className={`p-1 rounded ${skin.faint} ${skin.iconMuted} ${disabled ? 'cursor-not-allowed' : ''}`}
            disabled={disabled}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {(error || actionError) && (
        <p className="mt-1 text-xs text-red-500">{error || actionError}</p>
      )}

      {/* Dropdown */}
      {isOpen && (filteredOptions.length > 0 || offerCustom) && (
        <div
          // A click anywhere in the list (its padding, the scrollbar) is the list's own, never the
          // surrounding label's -- which would refocus the input and reopen the list
          onClick={event => event.preventDefault()}
          className={`absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto ${skin.border}`}
        >
          {/* Save row: the typed value joins the list itself, so it is there the next time too */}
          {offerCustom && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2 border-b
                ${skin.borderSoft} ${skin.optionHover} disabled:opacity-60`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Plus className={`w-3.5 h-3.5 shrink-0 ${skin.tileActiveText}`} />
                <span className="truncate">Save "<strong>{inputValue.trim()}</strong>"</span>
              </span>
              {saving
                ? <Loader2 className={`w-4 h-4 shrink-0 animate-spin ${skin.tileActiveText}`} />
                : <Check className={`w-4 h-4 shrink-0 ${skin.tileActiveText}`} />}
            </button>
          )}
          {/* Highlighting is indexed against this list, so it stays the arrow keys' own element */}
          <div ref={dropdownRef}>
            {filteredOptions.map((option, index) => (
              <div
                key={option.value}
                // mousedown is cancelled too, so the pick never blurs and refocuses the input
                onMouseDown={event => event.preventDefault()}
                onClick={event => handleSelect(option, event)}
                className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between gap-2
                  ${index === highlightedIndex || option.value === value ? skin.optionActive : skin.optionHover}
                `}
              >
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <span className="min-w-0 break-words">{option.label}</span>
                )}
                <span className="flex shrink-0 items-center gap-1">
                  {option.value === value && (
                    <Check className={`w-4 h-4 ${skin.tileActiveText}`} />
                  )}
                  {/* Only what the caller says may go carries a cross: a built-in value, or one
                      something already uses, cannot be taken out of the list */}
                  {onDeleteOption && option.removable && (
                    <button
                      type="button"
                      onClick={event => handleDelete(event, option)}
                      disabled={busy}
                      aria-label={`Delete ${option.label}`}
                      title={`Delete ${option.label}`}
                      className={`rounded p-1 ${skin.faint} ${skin.iconMuted} disabled:opacity-60`}
                    >
                      {deleting === option.value
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <X className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No results message. With a save row on offer the dropdown above is already showing it.
          The empty-list case matters just as much: an opened field with nothing behind it used to
          show a void, which read as broken rather than empty. */}
      {isOpen && filteredOptions.length === 0 && !offerCustom && (inputValue || normalizedOptions.length === 0) && (
        <div className={`absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg ${skin.border}`}>
          <div className={`px-3 py-2 text-sm ${skin.muted}`}>
            {inputValue ? (
              allowCustom ? (
                <span>No matches found. Press Enter to use "<strong>{inputValue}</strong>"</span>
              ) : (
                <span>No matches found</span>
              )
            ) : (
              allowCustom ? (
                <span>No saved options yet — type a name and press Enter to use it</span>
              ) : (
                <span>No options</span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;

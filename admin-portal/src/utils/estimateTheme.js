import { createContext, useContext } from 'react';

// Two skins for the estimate components that several portals share.
//
// `default` is the original slate/blue look every portal was built with. `warm` is the warm beige
// system the FP portal is being moved onto. The skin is opt-in per page -- a host passes
// `theme="warm"` -- so converting one portal never restyles the others, and a component that has
// not been threaded yet simply keeps the default.
const SKINS = {
  default: {
    // containers
    panel: 'border-gray-200 bg-white',
    panelHead: 'border-gray-200 bg-slate-50',
    panelFoot: 'border-gray-200 bg-slate-50',
    tint: 'border-blue-200 bg-blue-50/30',
    border: 'border-gray-200',
    borderSoft: 'border-gray-100',
    rowDivide: 'divide-gray-100',
    headRow: 'border-gray-200 text-gray-500',
    editingRow: 'bg-blue-50/40',
    // type
    heading: 'text-gray-800',
    text: 'text-gray-700',
    strong: 'text-gray-900',
    muted: 'text-gray-500',
    faint: 'text-gray-400',
    link: 'text-blue-600 hover:text-blue-700',
    // choice tiles
    tileActive: 'border-blue-500 bg-blue-50',
    tileIdle: 'border-gray-200 bg-white hover:border-gray-300',
    tileActiveText: 'text-blue-600',
    control: 'accent-blue-600',
    // fields
    field: 'border-gray-300 focus:border-blue-400 focus:ring-blue-200',
    fieldSoft: 'border-slate-200 text-slate-800 focus:border-blue-400 focus:ring-blue-100',
    inlineField: 'text-gray-800 placeholder:text-gray-400 hover:border-gray-200 focus:border-blue-400 focus:bg-white focus:ring-blue-100',
    label: 'text-slate-600',
    selectBorder: 'border-blue-200',
    inputBorder: 'border-gray-300',
    inputField: 'border-gray-300 focus:ring-blue-100 focus:border-blue-400',
    disabledField: 'disabled:bg-slate-50 disabled:text-slate-500',
    disabledSolid: 'disabled:bg-gray-200 disabled:text-gray-400',
    readOnlyBg: 'bg-slate-50',
    disabledBg: 'bg-gray-100',
    optionActive: 'bg-blue-50 text-blue-700',
    optionHover: 'hover:bg-gray-50',
    iconMuted: 'hover:bg-gray-100 hover:text-gray-600',
    inputLabel: 'text-gray-700',
    // actions
    primary: 'bg-blue-600 hover:bg-blue-700',
    secondary: 'border-slate-300 text-slate-700 hover:bg-slate-50',
    iconEdit: 'hover:bg-blue-50 hover:text-blue-600 focus:ring-blue-100',
    // dialog bits
    badge: 'bg-blue-100 text-blue-700',
    previewBox: 'border-slate-200 bg-slate-50',
    menuItem: 'text-slate-700 hover:bg-blue-50 hover:text-blue-700',
    toggleOn: 'border-blue-200 bg-blue-50 text-blue-700',
    toggleOff: 'border-slate-200 bg-white text-slate-600',
    toggleTrackOn: 'bg-blue-600',
    toggleTrackOff: 'bg-slate-300'
  },
  warm: {
    panel: 'border-warm-border bg-white shadow-warm',
    panelHead: 'border-warm-border bg-warm-section',
    panelFoot: 'border-warm-border bg-warm-section',
    tint: 'border-warm-border bg-warm-section/60',
    border: 'border-warm-border',
    borderSoft: 'border-warm-border/70',
    rowDivide: 'divide-warm-border/70',
    headRow: 'border-warm-border text-warm-muted',
    editingRow: 'bg-warm-accent-soft/60',
    heading: 'text-warm-text',
    text: 'text-warm-text',
    strong: 'text-warm-text',
    muted: 'text-warm-muted',
    faint: 'text-warm-muted',
    link: 'text-warm-accent-hover hover:text-warm-text',
    tileActive: 'border-warm-accent bg-warm-accent-soft',
    tileIdle: 'border-warm-border bg-white hover:border-warm-accent',
    tileActiveText: 'text-warm-accent-hover',
    control: 'accent-warm-accent',
    field: 'border-warm-border focus:border-warm-accent focus:ring-warm-accent/20',
    fieldSoft: 'border-warm-border text-warm-text focus:border-warm-accent focus:ring-warm-accent/20',
    inlineField: 'text-warm-text placeholder:text-warm-muted hover:border-warm-border focus:border-warm-accent focus:bg-white focus:ring-warm-accent/20',
    label: 'text-warm-muted',
    selectBorder: 'border-warm-border',
    inputBorder: 'border-warm-border',
    inputField: 'border-warm-border focus:border-warm-accent focus:ring-warm-accent/20',
    disabledField: 'disabled:bg-warm-section disabled:text-warm-muted',
    disabledSolid: 'disabled:bg-warm-border disabled:text-white',
    readOnlyBg: 'bg-warm-section',
    disabledBg: 'bg-warm-page',
    optionActive: 'bg-warm-accent-soft text-warm-text',
    optionHover: 'hover:bg-warm-section',
    iconMuted: 'hover:bg-warm-accent-soft hover:text-warm-accent-hover',
    inputLabel: 'text-warm-muted',
    // Solid calls to action stay green in the warm system; the tan accent carries icons,
    // highlights and active states, where white text on it would not hold up.
    primary: 'bg-emerald-700 hover:bg-emerald-800',
    secondary: 'border-warm-border text-warm-muted hover:bg-warm-section',
    iconEdit: 'hover:bg-warm-accent-soft hover:text-warm-accent-hover focus:ring-warm-accent/20',
    badge: 'bg-warm-accent-soft text-warm-text',
    previewBox: 'border-warm-border bg-warm-section',
    menuItem: 'text-warm-text hover:bg-warm-section hover:text-warm-accent-hover',
    toggleOn: 'border-warm-accent/50 bg-warm-accent-soft text-warm-text',
    toggleOff: 'border-warm-border bg-white text-warm-muted',
    toggleTrackOn: 'bg-warm-accent',
    toggleTrackOff: 'bg-warm-border'
  }
};

export const estimateSkin = theme => SKINS[theme === 'warm' ? 'warm' : 'default'];

// Class-level remap, for the bigger components that are converted wholesale rather than through the
// skin keys above. Every class the original markup used is a key here, so `skinClasses('warm')`
// rewrites a class string into the warm system while any other theme hands the string straight back
// -- the portals still on the original look render byte-identical markup. Classes that are not keys
// pass through untouched, which is what keeps semantic reds, ambers and greens intact.
const WARM_CLASSES = {
  'border-slate-200': 'border-warm-border',
  'border-slate-300': 'border-warm-border',
  'border-slate-100': 'border-warm-border/70',
  'border-slate-700': 'border-warm-text',
  'border-blue-200': 'border-warm-border',
  'border-blue-500': 'border-warm-accent',
  'hover:border-slate-300': 'hover:border-warm-accent',
  'divide-slate-100': 'divide-warm-border/70',
  'divide-slate-200': 'divide-warm-border',
  'bg-slate-50': 'bg-warm-section',
  'bg-slate-50/60': 'bg-warm-section/60',
  'bg-slate-50/70': 'bg-warm-section/70',
  'bg-slate-100': 'bg-warm-accent-soft',
  'bg-slate-300': 'bg-warm-border',
  'bg-slate-700': 'bg-warm-text',
  'bg-blue-50': 'bg-warm-accent-soft',
  'bg-blue-50/50': 'bg-warm-accent-soft/60',
  'bg-blue-600': 'bg-emerald-700',
  'hover:bg-blue-700': 'hover:bg-emerald-800',
  'hover:bg-slate-50': 'hover:bg-warm-section',
  'hover:bg-slate-50/60': 'hover:bg-warm-section/60',
  'hover:bg-blue-50': 'hover:bg-warm-accent-soft',
  'disabled:bg-slate-50': 'disabled:bg-warm-section',
  'disabled:text-slate-500': 'disabled:text-warm-muted',
  'text-slate-900': 'text-warm-text',
  'text-slate-800': 'text-warm-text',
  'text-slate-700': 'text-warm-text',
  'text-slate-600': 'text-warm-muted',
  'text-slate-500': 'text-warm-muted',
  'text-slate-400': 'text-warm-muted',
  'text-slate-300': 'text-warm-border',
  'text-blue-700': 'text-warm-text',
  'text-blue-600': 'text-warm-accent-hover',
  'accent-blue-600': 'accent-warm-accent',
  'focus:border-blue-500': 'focus:border-warm-accent',
  'focus:border-blue-400': 'focus:border-warm-accent',
  'focus:ring-blue-100': 'focus:ring-warm-accent/20',
  'focus:ring-blue-200': 'focus:ring-warm-accent/20',
  'focus-visible:outline-blue-500': 'focus-visible:outline-warm-accent',
  // Radius and shadow follow the warm spec: 12px cards, 10px inputs and buttons, soft warm shadow
  'rounded-lg': 'rounded-[10px]',
  'shadow-sm': 'shadow-warm'
};

const identity = classes => classes;
const toWarm = classes => String(classes ?? '').split(/(\s+)/).map(part => WARM_CLASSES[part] || part).join('');

export const skinClasses = theme => (theme === 'warm' ? toWarm : identity);

// A page announces its skin once and everything below reads it from here, which is how the deeply
// nested catalog screens get it without a theme prop threaded through every level. Unwrapped pages
// have no provider, so they keep the original look.
const EstimateThemeContext = createContext(undefined);

export const EstimateThemeProvider = EstimateThemeContext.Provider;
export const useEstimateTheme = () => useContext(EstimateThemeContext);
export const useSkinClasses = () => skinClasses(useContext(EstimateThemeContext));

export default estimateSkin;

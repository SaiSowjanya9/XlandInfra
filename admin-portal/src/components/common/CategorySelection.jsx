import { Home, Lock, Store } from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { id: 'residential', name: 'Residential', locked: false },
  { id: 'commercial', name: 'Commercial', locked: true }
];
const ICONS = { residential: Home, commercial: Store };

export default function CategorySelection({ categories = DEFAULT_CATEGORIES, onSelect }) {
  return <section aria-label="Customer category selection" className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-sm sm:p-8 lg:p-12">
    <div className="mb-10 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
      <p className="mt-2 text-gray-500">Choose the customer category to proceed</p>
    </div>
    <div className="flex flex-wrap justify-center gap-8">
      {categories.map(category => {
        const Icon = ICONS[category.id] || category.icon || Home;
        return <button key={category.id} type="button" disabled={category.locked}
          onClick={() => { if (!category.locked) onSelect?.(category.id); }}
          className={`relative flex h-52 w-full max-w-[18rem] shrink-0 flex-col items-start justify-center rounded-2xl border-2 bg-white p-8 text-left shadow-sm transition-all duration-200 ${category.locked ? 'cursor-not-allowed border-gray-200' : 'group border-teal-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2'}`}>
          {category.locked && <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500"><Lock className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />Coming Soon</span>}
          <span className={`mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${category.locked ? 'bg-gray-100' : 'bg-teal-500 transition-transform group-hover:scale-105'}`}>
            <Icon className={`h-7 w-7 ${category.locked ? 'text-gray-400' : 'text-white'}`} aria-hidden="true" />
          </span>
          <span className={`text-lg font-semibold [overflow-wrap:anywhere] ${category.locked ? 'text-gray-400' : 'text-gray-900'}`}>{category.name}</span>
        </button>;
      })}
    </div>
  </section>;
}

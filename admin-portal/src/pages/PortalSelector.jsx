import { Users, Briefcase, Truck, ArrowRight } from 'lucide-react';

const portals = [
  {
    key: 'employee',
    title: 'Employee Portal',
    description: 'Access dashboard, manage properties, and handle onboarding workflows.',
    icon: Briefcase,
    gradient: 'from-rose-500 to-red-600',
    hoverGradient: 'from-rose-600 to-red-700',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    ring: 'ring-rose-200',
    btnBg: 'bg-rose-600 hover:bg-rose-700',
    tags: [],
    tagBg: 'bg-rose-50 text-rose-700',
  },
  {
    key: 'customer',
    title: 'Customer Portal',
    description: 'Submit work orders, browse service categories, and track requests.',
    icon: Users,
    gradient: 'from-emerald-500 to-teal-600',
    hoverGradient: 'from-emerald-600 to-teal-700',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    ring: 'ring-emerald-200',
    btnBg: 'bg-emerald-600 hover:bg-emerald-700',
    tags: [],
    tagBg: 'bg-emerald-50 text-emerald-700',
  },
  {
    key: 'vendor',
    title: 'Vendor Portal',
    description: 'Manage vendor profiles, contracts, and service assignments.',
    icon: Truck,
    gradient: 'from-amber-500 to-orange-600',
    hoverGradient: 'from-amber-600 to-orange-700',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    ring: 'ring-amber-200',
    btnBg: 'bg-amber-600 hover:bg-amber-700',
    tags: ['Coming Soon'],
    tagBg: 'bg-amber-50 text-amber-700',
  },
];

const PortalSelector = ({ onSelectPortal }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 flex flex-col relative overflow-hidden font-gotham">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full py-6 px-6 md:px-10 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center space-x-4">
          <img
            src="/logo.png"
            alt="XLand Infra Logo"
            className="h-12 w-auto object-contain drop-shadow-md"
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-12 relative z-10">
        <div className="w-full max-w-5xl">
          {/* Title */}
          <div className="text-center mb-14">
            <h1 className="text-4xl md:text-5xl font-semibold text-white mb-4 tracking-tight">
              System Administration Portal
            </h1>
            <p className="text-stone-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Choose the appropriate login portal to continue with an experience tailored to your role.
            </p>
          </div>

          {/* Portal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <button
                  key={portal.key}
                  onClick={() => onSelectPortal(portal.key)}
                  className="group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-7 text-left transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white/20 overflow-hidden"
                >
                  {/* Gradient top border */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${portal.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />

                  {/* Glow Effect */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${portal.gradient} opacity-0 group-hover:opacity-[0.07] transition-opacity duration-300`} />

                  {/* Top-right tag for vendor */}
                  {portal.tags.length > 0 && (
                    <div className="absolute top-5 right-5 z-10">
                      {portal.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full ${portal.tagBg} border border-white/10 shadow-sm`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`relative w-14 h-14 ${portal.iconBg} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                    <Icon className={`w-7 h-7 ${portal.iconColor}`} />
                  </div>

                  {/* Title */}
                  <h3 className="relative text-xl font-semibold text-white mb-2">
                    {portal.title}
                  </h3>

                  {/* Description */}
                  <p className="relative text-sm text-stone-400 mb-5 leading-relaxed">
                    {portal.description}
                  </p>

                  {/* CTA */}
                  <div className={`relative inline-flex items-center space-x-2 text-sm font-semibold ${portal.iconColor} group-hover:translate-x-1 transition-transform duration-300`}>
                    <span>Enter Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center relative z-10">
        <p className="text-stone-500 text-xs">&copy; 2025 XLand Infra. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PortalSelector;

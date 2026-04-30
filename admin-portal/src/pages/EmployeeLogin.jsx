import { useState, useEffect } from 'react';
import { 
  Eye, EyeOff, AlertCircle, ArrowLeft, Shield, Users, 
  UserCheck, Briefcase, Building2, ChevronRight, Lock,
  Sparkles, User
} from 'lucide-react';
import { authenticateUser, getUsers, USER_ROLES, initializeUsers } from '../utils/userStore';

const EmployeeLogin = ({ onLogin, onBack }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showQuickLogin, setShowQuickLogin] = useState(false);

  useEffect(() => {
    initializeUsers();
  }, []);

  const roleCards = [
    { role: 'Admin', icon: Shield, gradient: 'from-red-500 to-rose-600', bgGlow: 'bg-red-500/20' },
    { role: 'Manager', icon: Briefcase, gradient: 'from-blue-500 to-indigo-600', bgGlow: 'bg-blue-500/20' },
    { role: 'Supervisor', icon: UserCheck, gradient: 'from-emerald-500 to-green-600', bgGlow: 'bg-emerald-500/20' },
    { role: 'Executive', icon: Users, gradient: 'from-purple-500 to-violet-600', bgGlow: 'bg-purple-500/20' },
  ];

  const quickLogins = [
    { username: 'admin', password: 'admin123', role: 'Admin', name: 'System Administrator' },
    { username: 'manager1', password: 'manager123', role: 'Manager', name: 'Rahul Sharma' },
    { username: 'supervisor1', password: 'super123', role: 'Supervisor', name: 'Priya Patel' },
    { username: 'executive1', password: 'exec123', role: 'Executive', name: 'Amit Kumar' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    setTimeout(() => {
      const result = authenticateUser(formData.username, formData.password);
      
      if (result.success) {
        onLogin({ ...result.user, portal: 'employee' });
      } else {
        setError(result.message || 'Invalid credentials');
      }
      setLoading(false);
    }, 800);
  };

  const handleQuickLogin = (credentials) => {
    setFormData({ username: credentials.username, password: credentials.password });
    setSelectedRole(credentials.role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-500" />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <div className="relative w-full max-w-5xl">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-white/60 hover:text-white mb-8 transition-all group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Portal Selection</span>
        </button>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding & Role Cards */}
          <div className="space-y-8">
            {/* Logo & Title */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Property Management</h1>
                  <p className="text-slate-400 text-sm">Employee Portal</p>
                </div>
              </div>
              <p className="text-slate-300 text-lg leading-relaxed">
                Access your dashboard with role-based permissions. Select your role or sign in directly.
              </p>
            </div>

            {/* Role Selection Cards */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Your Role</p>
              <div className="grid grid-cols-2 gap-3">
                {roleCards.map(({ role, icon: Icon, gradient, bgGlow }) => (
                  <button
                    key={role}
                    onClick={() => {
                      setSelectedRole(role);
                      const quickLogin = quickLogins.find(q => q.role === role);
                      if (quickLogin) {
                        setFormData({ username: quickLogin.username, password: '' });
                      }
                    }}
                    className={`group relative p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden ${
                      selectedRole === role
                        ? 'border-white/30 bg-white/10 scale-[1.02]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {/* Glow Effect */}
                    <div className={`absolute -inset-1 ${bgGlow} blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300`} />
                    
                    <div className="relative flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{role}</p>
                        <p className="text-xs text-slate-400">{USER_ROLES[role].description}</p>
                      </div>
                    </div>
                    
                    {selectedRole === role && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Login Toggle */}
            <button
              onClick={() => setShowQuickLogin(!showQuickLogin)}
              className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>{showQuickLogin ? 'Hide' : 'Show'} Demo Accounts</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showQuickLogin ? 'rotate-90' : ''}`} />
            </button>

            {/* Quick Login Cards */}
            {showQuickLogin && (
              <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-4 duration-300">
                {quickLogins.map((login) => (
                  <button
                    key={login.username}
                    onClick={() => handleQuickLogin(login)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.username === login.username
                        ? 'border-indigo-500 bg-indigo-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleCards.find(r => r.role === login.role)?.gradient} flex items-center justify-center`}>
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{login.name}</p>
                        <p className="text-xs text-slate-400">{login.role}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Side - Login Form */}
          <div className="relative">
            {/* Glassmorphism Card */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
              {/* Form Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
                <p className="text-slate-400 mt-2">
                  {selectedRole ? `Signing in as ${selectedRole}` : 'Enter your credentials to continue'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Username or Email</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all pr-12"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center space-x-2 text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl animate-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-4 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:-translate-y-0.5"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In
                      <ChevronRight className="w-5 h-5" />
                    </span>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-center text-xs text-slate-500">
                  Protected by enterprise-grade security
                </p>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full blur-2xl opacity-30" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full blur-2xl opacity-20" />
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="mt-12 grid grid-cols-4 gap-4">
          {[
            { label: 'Properties', value: '500+' },
            { label: 'Vendors', value: '200+' },
            { label: 'Work Orders', value: '10K+' },
            { label: 'Users', value: '50+' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;

import { useState } from 'react';
import { 
  Eye, EyeOff, AlertCircle, ArrowLeft, Building2, User, Lock, Briefcase
} from 'lucide-react';

const FPLogin = ({ onLogin, onBack }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/fp/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const user = {
          id: result.data.user.id,
          username: result.data.user.username,
          email: result.data.user.email,
          firstName: result.data.user.firstName,
          lastName: result.data.user.lastName,
          name: `${result.data.user.firstName} ${result.data.user.lastName}`.trim(),
          companyName: result.data.user.companyName,
          role: result.data.user.role,
          roleName: result.data.user.roleName,
          franchisePartnerId: result.data.user.franchisePartnerId,
          token: result.data.token,
          portal: 'franchise'
        };
        
        sessionStorage.setItem('pm_auth_token', result.data.token);
        sessionStorage.setItem('pm_current_user', JSON.stringify(user));
        
        onLogin(user);
      } else {
        setError(result.message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-700/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-teal-600/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-700/10 via-transparent to-indigo-700/10 rounded-full blur-3xl" />
      </div>
      
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-300 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Portal Selection</span>
        </button>

        {/* Login Card */}
        <div className="relative bg-blue-800/80 backdrop-blur-xl border border-blue-700/50 rounded-2xl p-8 shadow-2xl shadow-black/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 border border-blue-400/30 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Briefcase className="w-7 h-7 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-white">Franchise Partner Portal</h1>
            <p className="text-blue-300 text-sm mt-1">Sign in to manage your franchise operations</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-blue-200">Username or Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" strokeWidth={1.5} />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-blue-900/60 border border-blue-600/50 rounded-lg text-white placeholder-blue-400 focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500/50 outline-none transition-all"
                  placeholder="Enter username or email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-blue-200">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" strokeWidth={1.5} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-12 py-3 bg-blue-900/60 border border-blue-600/50 rounded-lg text-white placeholder-blue-400 focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500/50 outline-none transition-all"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-300 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center shadow-lg shadow-blue-500/30"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <span>Sign In to FP Portal</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-blue-700/50 text-center">
            <p className="text-blue-400 text-xs">
              Access restricted to authorized Franchise Partners only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPLogin;

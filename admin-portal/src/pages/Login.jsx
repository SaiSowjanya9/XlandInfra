import { useState } from 'react';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import SetPassword from './SetPassword';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        const userData = result.data;
        
        // Check if user must change password (first login)
        if (userData.mustChangePassword) {
          setPendingUser({
            ...userData.user,
            name: `${userData.user.firstName || ''} ${userData.user.lastName || ''}`.trim(),
            email: userData.user.email,
            portal: 'admin'
          });
          setShowSetPassword(true);
        } else {
          // Store token and proceed
          if (userData.token) {
            sessionStorage.setItem('pm_auth_token', userData.token);
          }
          const user = {
            ...userData.user,
            name: `${userData.user.firstName || ''} ${userData.user.lastName || ''}`.trim(),
            portal: 'admin'
          };
          sessionStorage.setItem('pm_current_user', JSON.stringify(user));
          onLogin(user);
        }
      } else {
        setError(result.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle password set completion
  const handlePasswordSet = (updatedUser) => {
    setShowSetPassword(false);
    setPendingUser(null);
    onLogin(updatedUser);
  };

  // Show Set Password screen if needed
  if (showSetPassword && pendingUser) {
    return (
      <SetPassword 
        user={pendingUser} 
        onPasswordSet={handlePasswordSet}
        onCancel={() => {
          setShowSetPassword(false);
          setPendingUser(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Portal Admin</h1>
          <p className="text-gray-500 mt-2">Sign in to access the admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username or Email
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input-field"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-field pr-10"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 text-center">
            <strong>Demo Access:</strong><br />
            Contact administrator for credentials
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, Lock, Mail, Key, Loader2, ShieldCheck } from 'lucide-react';
import Logo from '../assets/LOGO 2.png';

const ActivateAccount = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [customerData, setCustomerData] = useState(null);
  
  const [formData, setFormData] = useState({
    email: '',
    tempPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswords, setShowPasswords] = useState({
    temp: false,
    new: false,
    confirm: false
  });
  
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/customers/activate/${token}`);
        const result = await response.json();
        
        if (result.success) {
          setTokenValid(true);
          setCustomerData(result.data);
          setFormData(prev => ({ ...prev, email: result.data.email }));
        } else {
          setTokenError(result.message);
          if (result.alreadyActivated) {
            setTimeout(() => navigate('/login'), 3000);
          }
        }
      } catch (error) {
        setTokenError('Unable to validate activation link. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      validateToken();
    } else {
      setTokenError('Invalid activation link');
      setLoading(false);
    }
  }, [token, navigate]);

  // Password validation
  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('One number');
    return errors;
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    }
    
    if (!formData.tempPassword) {
      newErrors.tempPassword = 'Temporary password is required';
    }
    
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else {
      const passwordErrors = validatePassword(formData.newPassword);
      if (passwordErrors.length > 0) {
        newErrors.newPassword = `Password must have: ${passwordErrors.join(', ')}`;
      }
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSubmitting(true);
    setErrors({});
    
    try {
      const response = await fetch('/api/customers/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: formData.email,
          tempPassword: formData.tempPassword,
          newPassword: formData.newPassword
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setErrors({ submit: result.message });
      }
    } catch (error) {
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center">
        <div className="text-center">
          <img src={Logo} alt="XLAND INFRA" className="h-16 w-auto mx-auto mb-6 animate-pulse" />
          <Loader2 className="w-10 h-10 text-gold-400 animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">Validating activation link...</p>
        </div>
      </div>
    );
  }

  // Token error state
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4">
        <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-500/30">
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Activation Failed</h2>
            <p className="text-gray-400 mb-6">{tokenError}</p>
            <Link 
              to="/login" 
              className="inline-flex items-center space-x-2 text-gold-400 hover:text-gold-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4">
        <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold-500/30">
          <div className="px-6 py-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-gold-500/30">
              <CheckCircle className="w-10 h-10 text-dark-900" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Account Activated!</h2>
            <p className="text-gray-400 mb-6">
              Your account has been successfully activated. You can now log in with your new password.
            </p>
            <p className="text-gold-400 text-sm">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Back to Home */}
      <Link to="/" className="absolute top-6 left-6 flex items-center space-x-2 text-gold-400 hover:text-gold-300 transition-colors z-10">
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back to Home</span>
      </Link>

      <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold-600/20 relative z-10">
        {/* Header */}
        <div className="px-6 py-8 text-center border-b border-gold-600/20 bg-gradient-to-b from-dark-700/50 to-transparent">
          <img src={Logo} alt="XLAND INFRA" className="h-16 w-auto mx-auto mb-4" />
          <div className="flex items-center justify-center space-x-2 mb-2">
            <ShieldCheck className="w-6 h-6 text-gold-400" />
            <h1 className="text-xl font-bold text-white">Activate Your Account</h1>
          </div>
          <p className="text-dark-300 text-sm">Set your password to complete activation</p>
          {customerData?.propertyName && (
            <p className="text-gold-400 text-sm mt-2 font-medium">{customerData.propertyName}</p>
          )}
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gold-400" />
                  <span>Registered Email</span>
                </div>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field bg-dark-700/50"
                placeholder="your.email@example.com"
                required
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Temporary Password Field */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-gold-400" />
                  <span>Temporary Password</span>
                </div>
              </label>
              <div className="relative">
                <input
                  type={showPasswords.temp ? 'text' : 'password'}
                  value={formData.tempPassword}
                  onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                  className="input-field pr-10 font-mono tracking-wider"
                  placeholder="Enter temporary password from email"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, temp: !showPasswords.temp })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-gold-400 transition-colors"
                >
                  {showPasswords.temp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.tempPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.tempPassword}</p>
              )}
            </div>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dark-600"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-dark-800 text-dark-400 text-xs">SET NEW PASSWORD</span>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-gold-400" />
                  <span>New Password</span>
                </div>
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="input-field pr-10"
                  placeholder="Create a strong password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-gold-400 transition-colors"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.newPassword}</p>
              )}
              <p className="text-dark-400 text-xs mt-1">
                Min 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-gold-400" />
                  <span>Re-enter New Password</span>
                </div>
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="input-field pr-10"
                  placeholder="Confirm your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-gold-400 transition-colors"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
              )}
              {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                <p className="text-green-400 text-xs mt-1 flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>Passwords match</span>
                </p>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center space-x-2 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{errors.submit}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-gold-500/20 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Activate Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-dark-400">
              Already activated?{' '}
              <Link to="/login" className="text-gold-400 font-medium hover:text-gold-300 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivateAccount;

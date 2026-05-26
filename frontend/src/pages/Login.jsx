import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ArrowLeft, Mail, Info } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import SEO from '../components/SEO';

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notActivated, setNotActivated] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailResent, setEmailResent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotActivated(false);
    setEmailResent(false);
    setLoading(true);

    try {
      // First try customer accounts API
      const customerResponse = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const customerResult = await customerResponse.json();

      if (customerResult.success) {
        // Store token and customer data
        localStorage.setItem('customerToken', customerResult.data.token);
        onLogin(customerResult.data.customer);
        navigate('/dashboard');
        return;
      }

      // Check if account not activated
      if (customerResult.notActivated) {
        setNotActivated(true);
        setError(customerResult.message);
        setLoading(false);
        return;
      }

      // If customer login failed, try legacy residents API
      const residentsResponse = await fetch('/api/residents/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const residentsResult = await residentsResponse.json();

      if (residentsResult.success) {
        onLogin(residentsResult.data);
        navigate('/dashboard');
      } else {
        // Show the more specific error message
        setError(customerResult.message || residentsResult.message || 'Invalid email or password');
      }
    } catch (error) {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendActivation = async () => {
    setResendingEmail(true);
    try {
      const response = await fetch('/api/customers/resend-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });

      const result = await response.json();
      
      if (result.success) {
        setEmailResent(true);
        setNotActivated(false);
        setError('');
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to resend activation email. Please try again.');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      <SEO 
        title="Login - HomeHub Customer Portal"
        description="Login to your XLAND INFRA HomeHub customer portal. Access project details, track construction progress, and manage your property investments."
        keywords="login, customer portal, HomeHub, XLAND INFRA, real estate services"
        canonical="https://xlandinfra.com/login"
      />
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Back to Home */}
      <Link to="/" className="absolute top-6 left-6 flex items-center space-x-2 text-gold-400 hover:text-gold-300 transition-colors z-10">
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back to Home</span>
      </Link>

      <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold-600/20 relative z-10 mt-16 md:mt-0">
        {/* Header */}
        <div className="px-6 py-8 text-center border-b border-gold-600/20">
          <div className="flex justify-center mb-4">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">Customer Portal</h1>
          <p className="text-dark-300 mt-2">Sign in to your account</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-dark-200">Password</label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-gold-400 hover:text-gold-300 font-medium"
                >
                  Forgot Password?
                </Link>
              </div>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-gold-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Email Resent Success */}
            {emailResent && (
              <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg flex items-start space-x-2 text-green-400">
                <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Activation email sent!</p>
                  <p className="text-green-400/80">Check your inbox for the activation link.</p>
                </div>
              </div>
            )}

            {/* Not Activated Warning */}
            {notActivated && (
              <div className="p-3 bg-amber-900/30 border border-amber-500/50 rounded-lg">
                <div className="flex items-start space-x-2 text-amber-400">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm flex-1">
                    <p className="font-medium mb-1">Account Not Activated</p>
                    <p className="text-amber-400/80 mb-3">{error}</p>
                    <button
                      type="button"
                      onClick={handleResendActivation}
                      disabled={resendingEmail}
                      className="text-amber-300 hover:text-amber-200 font-medium underline underline-offset-2"
                    >
                      {resendingEmail ? 'Sending...' : 'Resend Activation Email'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* General Error */}
            {error && !notActivated && !emailResent && (
              <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center space-x-2 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-dark-700/50 rounded-lg border border-dark-600">
            <p className="text-xs text-dark-400 text-center">
              <button
                onClick={() => {
                  navigate('/');
                  setTimeout(() => {
                    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 150);
                }}
                className="text-gold-400 hover:text-gold-300 font-semibold underline underline-offset-2"
              >
                Need an account?
              </button>{' '}
              Start your Property Management journey with XLand Infra now!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

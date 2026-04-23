import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Check, ChevronDown, User, Mail, Phone, Home } from 'lucide-react';
import Logo from '../assets/LOGO 2.png';

const Register = ({ onRegisterSuccess }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifiedResident, setVerifiedResident] = useState(null);

  const [formData, setFormData] = useState({
    unitId: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const response = await fetch('/api/units');
      const result = await response.json();
      if (result.success) {
        setUnits(result.data);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/residents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: formData.unitId,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone
        })
      });

      const result = await response.json();

      if (result.success) {
        setVerifiedResident(result.data);
        setStep(2);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/residents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId: verifiedResident.residentId,
          password: formData.password
        })
      });

      const result = await response.json();

      if (result.success) {
        setStep(3);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Unable to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
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

      <div className="bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gold-600/20 relative z-10">
        {/* Header */}
        <div className="px-6 py-8 text-center border-b border-gold-600/20">
          <img src={Logo} alt="XLand Infra" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">New Customer</h1>
          <p className="text-dark-300 mt-2">Get started with your account</p>
        </div>

        <div className="p-6">
          {/* Step 1: Verify Information */}
          {step === 1 && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white">Need an Account?</h2>
                <p className="text-sm text-dark-300 mt-1">
                  Enter your information exactly as it appears on your leasing documents.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">
                    <Home className="w-4 h-4 inline mr-1 text-gold-400" />
                    Select your Unit *
                  </label>
                  <select
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="select-field"
                    required
                  >
                    <option value="">Select your unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">
                    <Mail className="w-4 h-4 inline mr-1 text-gold-400" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">
                    <Phone className="w-4 h-4 inline mr-1 text-gold-400" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                    placeholder="555-0123"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-300">Error</p>
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    </div>
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
                    'Continue'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-dark-300">
                  Already have an account?{' '}
                  <button onClick={() => navigate('/login')} className="text-gold-400 font-medium hover:text-gold-300 transition-colors">
                    Sign In
                  </button>
                </p>
              </div>
            </>
          )}

          {/* Step 2: Create Password */}
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex items-center text-gold-400 hover:text-gold-300 mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white">Create Your Password</h2>
                <p className="text-sm text-dark-300 mt-1">
                  Welcome, {verifiedResident?.firstName}! Set up your password to complete registration.
                </p>
              </div>

              <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg">
                <div className="flex items-center space-x-2 text-green-400">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Verified!</span>
                </div>
                <p className="text-sm text-green-300 mt-1">
                  {verifiedResident?.propertyName} - Unit {verifiedResident?.unitNumber}
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    placeholder="At least 6 characters"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="input-field"
                    placeholder="Confirm your password"
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center space-x-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
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
                    'Complete Registration'
                  )}
                </button>
              </form>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-900/30 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Registration Complete!</h2>
              <p className="text-dark-300 mb-6">
                Your account has been created successfully. You can now sign in to access the customer portal.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Sign In Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;

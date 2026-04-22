import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Shield, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [step, setStep] = useState(1); // 1 = credentials, 2 = OTP
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userId, setUserId] = useState(null);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const { loginRequest, verifyOtp } = useAuth();
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Step 1: Submit credentials
  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginRequest(username, password);
      if (result.otpRequired) {
        setUserId(result.userId);
        setStep(2);
      }
    } catch (err) {
      setError(err.message || 'Identifiants invalides.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (code) => {
    const fullCode = code || otpCode.join('');
    if (fullCode.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const result = await verifyOtp(userId, fullCode);
      const role = result?.role;
      navigate(role === 'scanner' ? '/admin/scan' : '/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Code invalide.');
      setOtpCode(['', '', '', '', '', '']);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await loginRequest(username, password);
      setError('');
      setOtpCode(['', '', '', '', '', '']);
      otpRefs[0].current?.focus();
    } catch (err) {
      setError(err.message || 'Erreur lors du renvoi.');
    } finally {
      setResending(false);
    }
  };

  // OTP input handler
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 6 digits entered
    const fullCode = newOtp.join('');
    if (fullCode.length === 6) {
      handleVerifyOtp(fullCode);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      const newOtp = paste.split('');
      setOtpCode(newOtp);
      handleVerifyOtp(paste);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-[#C42826] focus:ring-1 focus:ring-[#C42826] outline-none transition';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo_lassm.svg" alt="LASSM" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        </div>

        {/* Step 1: Credentials */}
        {step === 1 && (
          <form onSubmit={handleCredentials} className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom d'utilisateur</label>
                <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="********" className={inputCls} />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="mt-6 w-full rounded-lg bg-[#C42826] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a82220] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer">
              {loading ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 2 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#C42826]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield size={28} className="text-[#C42826]" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Vérification par email</h2>
              <p className="text-sm text-gray-500 mt-1">Un code à 6 chiffres a été envoyé à votre adresse email</p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            {/* OTP Input */}
            <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
              {otpCode.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:border-[#C42826] focus:ring-2 focus:ring-[#C42826]/20 focus:bg-white outline-none transition"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button onClick={() => handleVerifyOtp()} disabled={loading || otpCode.join('').length !== 6}
              className="w-full rounded-lg bg-[#C42826] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#a82220] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer">
              {loading ? 'Vérification...' : 'Vérifier le code'}
            </button>

            <div className="flex items-center justify-between mt-4">
              <button onClick={() => { setStep(1); setError(''); setOtpCode(['', '', '', '', '', '']); }}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer">
                <ArrowLeft size={14} /> Retour
              </button>
              <button onClick={handleResend} disabled={resending}
                className="text-sm text-[#C42826] hover:underline disabled:opacity-50 cursor-pointer">
                {resending ? 'Envoi...' : 'Renvoyer le code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

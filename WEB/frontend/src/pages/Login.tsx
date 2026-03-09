import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../services/http';
import { useAuthContext } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthContext();

  // form state
  const [identifier, setIdentifier] = useState(''); // email hoặc username
  const [password, setPassword] = useState('');

  // ui state
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // nếu vừa reset password thành công (VerifyOTP sẽ navigate về login với state.successMessage)
  const successMessage =
    (location.state && (location.state as any).successMessage) || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // chuẩn hoá input: nếu user gõ email thì toLowerCase(),
      // nếu user gõ username thuần thì cũng không sao
      const identifierClean = identifier.trim();
      const isEmail = identifierClean.includes('@');
      
      // 1. Gọi login để lấy JWT access/refresh
      // Backend LoginView ở /api/accounts/login/
      // Body: { username, password } hoặc { email, password }
      // Response: { tokens: { access, refresh }, role, ... }
      const loginPayload: any = {
        password,
      };
      
      // Backend chấp nhận cả username hoặc email, nhưng chỉ cần gửi 1 trong 2
      if (isEmail) {
        loginPayload.email = identifierClean.toLowerCase();
      } else {
        loginPayload.username = identifierClean.toLowerCase();
      }
      
      console.log('[Login] Sending login request:', { ...loginPayload, password: '***' });
      const tokenResp = await api.post('/accounts/login/', loginPayload);
      console.log('[Login] Login response:', tokenResp.data);

      const accessToken = tokenResp.data?.tokens?.access; // <--- Cần kiểm tra lại cấu trúc: tokens.access
      const refreshToken = tokenResp.data?.tokens?.refresh; // <--- Cần kiểm tra lại cấu trúc: tokens.refresh
      const loginRole = tokenResp.data?.role; // <--- Lấy role từ Response API Login

      if (!accessToken) {
        setError('Đăng nhập thất bại: không nhận được token.');
        setSubmitting(false);
        return;
      }

      // Xóa token cũ trước khi lưu token mới (tránh conflict)
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      
      // Lưu access token vào localStorage TRƯỚC khi gọi /me/
      // Đảm bảo token được trim để loại bỏ whitespace
      localStorage.setItem('authToken', accessToken.trim());
      
      // Lưu refresh token (optional, để sau này gọi /token/refresh/)
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }

      // 2. Gọi /api/accounts/me/ để lấy thông tin user (id, email, role,...)
      // Interceptor trong http.ts sẽ tự động thêm token từ localStorage
      const meResp = await api.get('/accounts/me/');

      // backend MeView trả:
      // { id, username, email, role }
      const meData = meResp.data || {};

      // 3. Chuẩn hoá cho AuthContext
      const userData = {
        id: String(meData.id ?? ''),
        email: meData.email ?? '',
        role: (meData.role ?? 'customer') as
          | 'customer'
          | 'merchant'
          | 'shipper'
          | 'admin',
        name: meData.username ?? '',
      };

      // 4. Lưu accessToken + userData vào context
      // login() sẽ tự set localStorage.authToken
      login(accessToken, userData);

      // 5. Điều hướng sau khi login - ĐÃ CHỈNH SỬA LOGIC VAI TRÒ
      const destinationRole = userData.role;

      if (destinationRole === 'merchant' || destinationRole === 'admin') {
        // Chuyển hướng Merchant/Admin đến trang Dashboard
        navigate('/merchant/dashboard', { replace: true });
      } else {
        // Mặc định chuyển hướng Customer hoặc Shipper đến trang chủ
        navigate('/', { replace: true }); 
      }
      
    } catch (err: any) {
      console.error('Login failed:', err);
      console.error('Login error response:', err?.response?.data);
      console.error('Login error status:', err?.response?.status);

      // SimpleJWT khi login fail thường trả:
      // { "detail": "No active account found with the given credentials" }
      const fallbackMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Sai email / mật khẩu hoặc tài khoản chưa kích hoạt.';
      setError(fallbackMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl border-t-4 border-grabGreen-700">
        <h2 className="text-3xl font-bold text-center text-gray-900">
          Đăng nhập
        </h2>
        <p className="text-center text-gray-500 text-sm">
          Chào mừng quay lại 👋
        </p>

        {/* success message từ flow reset password hoặc đăng ký xong */}
        {successMessage && (
          <div className="p-3 text-sm font-medium text-grabGreen-800 bg-grabGreen-100 rounded-lg text-center">
            {successMessage}
          </div>
        )}

        {/* lỗi login */}
        {error && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 rounded-lg text-center">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Email / Username */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="identifier"
            >
              Email / Tên đăng nhập
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              autoComplete="username"
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-grabGreen-500 focus:border-grabGreen-500 outline-none"
              placeholder="you@example.com"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Nếu bạn đăng ký bằng OTP thì đây chính là email bạn dùng để đăng ký.
            </p>
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="password"
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-grabGreen-500 focus:border-grabGreen-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          {/* Quên mật khẩu */}
          <div className="text-right text-xs">
            <Link
              to="/forgot"
              className="text-grabGreen-700 hover:text-grabGreen-800 font-medium"
            >
              Quên mật khẩu?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full px-4 py-2 rounded-full text-white text-sm font-semibold shadow-md transition ${
              submitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-grabGreen-700 hover:bg-grabGreen-800'
            }`}
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Link đăng ký */}
        <div className="text-center text-sm text-gray-600">
          Chưa có tài khoản?{' '}
          <Link
            to="/register"
            className="text-grabGreen-700 hover:text-grabGreen-800 font-semibold"
          >
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
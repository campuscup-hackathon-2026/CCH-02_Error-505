import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { me, register } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { loginUser, setUser } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await register(form);
      loginUser(data.access_token);
      const profile = await me(data.access_token);
      setUser(profile);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="glass-card w-full max-w-md p-6 space-y-4">
        <h1 className="font-display text-3xl text-cyan">Create Sentinel Operator</h1>
        <input className="w-full p-3 bg-black/40 rounded border border-cyan/40" placeholder="Full Name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
        <input className="w-full p-3 bg-black/40 rounded border border-cyan/40" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <input className="w-full p-3 bg-black/40 rounded border border-cyan/40" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        {error && <p className="text-danger text-sm">{error}</p>}
        <button disabled={loading} className="w-full p-3 rounded bg-cyan text-black font-semibold hover:opacity-90 disabled:opacity-60">
          {loading ? 'Provisioning Account...' : 'Register'}
        </button>
        <p className="text-sm text-white/70">
          Already have an account? <Link className="text-cyan" to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

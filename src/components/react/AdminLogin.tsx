import { useEffect, useState, type FormEvent } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { base } from '../../lib/base';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setCheckingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = `${base}admin/dashboard`;
      } else {
        setCheckingSession(false);
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError('Login ou senha inválidos.');
      return;
    }
    window.location.href = `${base}admin/dashboard`;
  }

  if (!supabaseConfigured) {
    return (
      <p className="text-red-400">
        Site ainda sem conexão com o banco (configure as chaves do Supabase no .env).
      </p>
    );
  }

  if (checkingSession) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-lg border border-prank-border bg-prank-surface p-6"
    >
      <div>
        <label className="mb-1 block text-sm text-white/60">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-prank-border bg-prank-bg px-3 py-2 text-white outline-none focus:border-prank-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-white/60">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-prank-border bg-prank-bg px-3 py-2 text-white outline-none focus:border-prank-gold"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-prank-purple px-4 py-2 font-display font-semibold text-white transition-colors hover:bg-prank-purple/80 disabled:opacity-50"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      <a
        href={`${base}admin/esqueci-senha`}
        className="text-center text-sm text-prank-purple-light hover:text-prank-gold"
      >
        Esqueci minha senha
      </a>
      <p className="text-center text-xs text-white/40">
        Acesso restrito aos membros do time. Contas criadas manualmente no Supabase.
      </p>
    </form>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { base } from '../../lib/base';

const inputClass =
  'w-full rounded-md border border-prank-border bg-prank-bg px-3 py-2 text-white outline-none focus:border-prank-gold';
const labelClass = 'mb-1 block text-sm text-white/60';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;

    // O link do e-mail já autentica uma sessão temporária de recuperação ao carregar a página.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('As senhas não são iguais.');
      return;
    }
    if (password.length < 8) {
      setError('Use pelo menos 8 caracteres.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      window.location.href = `${base}admin/dashboard`;
    }, 1500);
  }

  if (!supabaseConfigured) {
    return (
      <p className="text-red-400">
        Site ainda sem conexão com o banco (configure as chaves do Supabase no .env).
      </p>
    );
  }

  if (done) {
    return <p className="text-center text-emerald-400">Senha atualizada! Te levando pro painel...</p>;
  }

  if (!ready) {
    return (
      <p className="text-center text-white/50">
        Abra essa página a partir do link recebido por e-mail.{' '}
        <a
          href={`${base}admin/esqueci-senha`}
          className="text-prank-purple-light hover:text-prank-gold"
        >
          Pedir um novo link
        </a>
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-lg border border-prank-border bg-prank-surface p-6"
    >
      <div>
        <label className={labelClass}>Nova senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Confirmar nova senha</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-prank-purple px-4 py-2 font-display font-semibold text-white transition-colors hover:bg-prank-purple/80 disabled:opacity-50"
      >
        {loading ? 'Salvando...' : 'Salvar nova senha'}
      </button>
    </form>
  );
}

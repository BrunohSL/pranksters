import { useState, type FormEvent } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { base } from '../../lib/base';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const redirectTo = `${window.location.origin}${base}admin/redefinir-senha`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  if (!supabaseConfigured) {
    return (
      <p className="text-red-400">
        Site ainda sem conexão com o banco (configure as chaves do Supabase no .env).
      </p>
    );
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm rounded-lg border border-prank-border bg-prank-surface p-6 text-center">
        <p className="text-white">
          Se esse e-mail estiver cadastrado, mandamos um link pra você criar uma senha nova.
          Confira também a caixa de spam.
        </p>
        <a
          href={`${base}admin`}
          className="mt-4 inline-block text-sm text-prank-purple-light hover:text-prank-gold"
        >
          Voltar pro login
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-lg border border-prank-border bg-prank-surface p-6"
    >
      <p className="text-sm text-white/60">
        Digite o e-mail cadastrado pelo time. Vamos te mandar um link pra você criar uma senha
        nova.
      </p>
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
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-prank-purple px-4 py-2 font-display font-semibold text-white transition-colors hover:bg-prank-purple/80 disabled:opacity-50"
      >
        {loading ? 'Enviando...' : 'Enviar link'}
      </button>
      <a href={`${base}admin`} className="text-center text-sm text-white/40 hover:text-prank-gold">
        Voltar pro login
      </a>
    </form>
  );
}

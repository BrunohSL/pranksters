import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';

interface Friendly {
  id: string;
  opponent_team: string;
  played_at: string;
  our_score: number;
  their_score: number;
  notes: string | null;
}

export default function FriendliesList() {
  const [rows, setRows] = useState<Friendly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setError('Site ainda sem conexão com o banco (configure as chaves do Supabase).');
      setLoading(false);
      return;
    }

    supabase
      .from('friendlies')
      .select('*')
      .order('played_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data as Friendly[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-white/50">Carregando amistosos...</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (rows.length === 0)
    return <p className="text-white/50">Nenhum amistoso registrado ainda.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((f) => {
        const won = f.our_score > f.their_score;
        const drew = f.our_score === f.their_score;
        return (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-prank-border bg-prank-surface px-4 py-3"
          >
            <div>
              <p className="font-display text-base font-semibold">
                Pranksters <span className="text-white/40">vs</span> {f.opponent_team}
              </p>
              <p className="text-xs text-white/40">
                {new Date(f.played_at + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
              {f.notes && <p className="mt-1 text-sm text-white/60">{f.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display text-2xl font-bold">
                {f.our_score} <span className="text-white/30">-</span> {f.their_score}
              </span>
              <span
                className={
                  'rounded px-2 py-1 text-xs font-bold uppercase ' +
                  (drew
                    ? 'bg-white/10 text-white/60'
                    : won
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400')
                }
              >
                {drew ? 'Empate' : won ? 'Vitória' : 'Derrota'}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';

interface Tournament {
  id: string;
  name: string;
  event_date: string;
  location: string | null;
  format: string | null;
  link: string | null;
  notes: string | null;
}

function isPast(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

export default function TournamentsList() {
  const [rows, setRows] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setError('Site ainda sem conexão com o banco (configure as chaves do Supabase).');
      setLoading(false);
      return;
    }

    supabase
      .from('tournaments')
      .select('*')
      .order('event_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data as Tournament[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-white/50">Carregando torneios...</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (rows.length === 0) return <p className="text-white/50">Nenhum torneio cadastrado ainda.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((t) => {
        const past = isPast(t.event_date);
        return (
          <li
            key={t.id}
            className={
              'rounded-lg border border-prank-border bg-prank-surface px-4 py-3 ' +
              (past ? 'opacity-50' : '')
            }
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-lg font-semibold">{t.name}</p>
              <span className="rounded bg-prank-surface-2 px-2 py-1 text-xs font-semibold text-prank-gold">
                {new Date(t.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/60">
              {[t.location, t.format].filter(Boolean).join(' · ')}
            </p>
            {t.notes && <p className="mt-1 text-sm text-white/50">{t.notes}</p>}
            {t.link && (
              <a
                href={t.link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm font-medium text-prank-purple-light hover:text-prank-gold"
              >
                Mais informações →
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

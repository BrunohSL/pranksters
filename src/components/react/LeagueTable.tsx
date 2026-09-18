import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';

interface StandingRow {
  season_id: string;
  season_name: string;
  total_rounds: number;
  player_id: string;
  player_name: string;
  rounds_played: number;
  total_wins: number;
  total_losses: number;
  total_points: number;
}

interface ActiveSeason {
  id: string;
  name: string;
  total_rounds: number;
}

export default function LeagueTable() {
  const [season, setSeason] = useState<ActiveSeason | null>(null);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setError('Site ainda sem conexão com o banco (configure as chaves do Supabase).');
      setLoading(false);
      return;
    }

    (async () => {
      const { data: activeSeason, error: seasonErr } = await supabase
        .from('league_seasons')
        .select('id, name, total_rounds')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seasonErr) {
        setError(seasonErr.message);
        setLoading(false);
        return;
      }

      if (!activeSeason) {
        setSeason(null);
        setLoading(false);
        return;
      }

      setSeason(activeSeason);

      const [{ count }, { data: standings, error: standingsErr }] = await Promise.all([
        supabase
          .from('league_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('season_id', activeSeason.id),
        supabase.from('league_standings').select('*').eq('season_id', activeSeason.id),
      ]);

      setRoundsPlayed(count ?? 0);
      if (standingsErr) setError(standingsErr.message);
      else setRows((standings as StandingRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-white/50">Carregando classificação...</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!season)
    return <p className="text-white/50">Nenhuma temporada da liga ativa no momento.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-white">{season.name}</h2>
        <span className="rounded bg-prank-surface-2 px-3 py-1 text-sm font-semibold text-prank-gold">
          Rodada {roundsPlayed} de {season.total_rounds}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-white/50">Nenhuma rodada lançada ainda nesta temporada.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-prank-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-prank-surface-2 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Jogador</th>
                <th className="px-4 py-3 text-center">Rodadas</th>
                <th className="px-4 py-3 text-center">V</th>
                <th className="px-4 py-3 text-center">D</th>
                <th className="px-4 py-3 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.player_id} className="border-t border-prank-border/60">
                  <td className="px-4 py-3 font-display font-semibold text-prank-gold">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{row.player_name}</td>
                  <td className="px-4 py-3 text-center text-white/70">{row.rounds_played}</td>
                  <td className="px-4 py-3 text-center text-emerald-400">{row.total_wins}</td>
                  <td className="px-4 py-3 text-center text-red-400">{row.total_losses}</td>
                  <td className="px-4 py-3 text-right font-display text-lg font-bold">
                    {row.total_points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-white/40">
        Pontuação: 3 pontos por vitória + 1 ponto de participação na rodada.
      </p>
    </div>
  );
}

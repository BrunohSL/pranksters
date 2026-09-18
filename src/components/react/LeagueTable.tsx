import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';

interface Season {
  id: string;
  name: string;
  total_rounds: number;
  is_active: boolean;
}

interface RoundInfo {
  id: string;
  round_number: number;
  round_date: string;
}

interface StandingRow {
  player_id: string;
  player_name: string;
  rounds_played: number;
  total_wins: number;
  total_losses: number;
  total_points: number;
}

interface RoundResultRow {
  player_name: string;
  wins: number;
  losses: number;
  points: number;
}

type Tab = 'standings' | number;

const tabButtonClass = (active: boolean) =>
  'shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition-colors ' +
  (active ? 'bg-prank-purple text-white' : 'bg-prank-surface-2 text-white/60 hover:text-white');

export default function LeagueTable() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [roundResults, setRoundResults] = useState<Record<number, RoundResultRow[]>>({});
  const [tab, setTab] = useState<Tab>('standings');
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingSeasonData, setLoadingSeasonData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setError('Site ainda sem conexão com o banco (configure as chaves do Supabase).');
      setLoadingSeasons(false);
      return;
    }

    (async () => {
      const { data, error: err } = await supabase
        .from('league_seasons')
        .select('id, name, total_rounds, is_active')
        .order('created_at', { ascending: false });

      if (err) {
        setError(err.message);
        setLoadingSeasons(false);
        return;
      }

      const list = (data as Season[]) ?? [];
      setSeasons(list);
      const initial = list.find((s) => s.is_active) ?? list[0];
      if (initial) setSelectedSeasonId(initial.id);
      setLoadingSeasons(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSeasonId) return;
    setLoadingSeasonData(true);
    setTab('standings');

    (async () => {
      const [roundsRes, standingsRes, resultsRes] = await Promise.all([
        supabase
          .from('league_rounds')
          .select('id, round_number, round_date')
          .eq('season_id', selectedSeasonId)
          .order('round_number', { ascending: true }),
        supabase.from('league_standings').select('*').eq('season_id', selectedSeasonId),
        supabase
          .from('league_results')
          .select('wins, losses, points, league_players(name), league_rounds!inner(round_number, season_id)')
          .eq('league_rounds.season_id', selectedSeasonId),
      ]);

      setRounds((roundsRes.data as RoundInfo[]) ?? []);
      setStandings((standingsRes.data as StandingRow[]) ?? []);

      const grouped: Record<number, RoundResultRow[]> = {};
      for (const row of (resultsRes.data as unknown as Array<{
        wins: number;
        losses: number;
        points: number;
        league_players: { name: string } | null;
        league_rounds: { round_number: number } | null;
      }>) ?? []) {
        const roundNumber = row.league_rounds?.round_number;
        if (roundNumber == null) continue;
        if (!grouped[roundNumber]) grouped[roundNumber] = [];
        grouped[roundNumber].push({
          player_name: row.league_players?.name ?? '—',
          wins: row.wins,
          losses: row.losses,
          points: row.points,
        });
      }
      for (const key of Object.keys(grouped)) {
        grouped[Number(key)].sort(
          (a, b) => b.points - a.points || b.wins - a.wins || a.player_name.localeCompare(b.player_name, 'pt-BR'),
        );
      }
      setRoundResults(grouped);
      setLoadingSeasonData(false);
    })();
  }, [selectedSeasonId]);

  if (loadingSeasons) return <p className="text-white/50">Carregando...</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (seasons.length === 0) return <p className="text-white/50">Nenhuma liga cadastrada ainda.</p>;

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select
          value={selectedSeasonId}
          onChange={(e) => setSelectedSeasonId(e.target.value)}
          className="rounded-md border border-prank-border bg-prank-surface px-3 py-2 text-white outline-none focus:border-prank-gold"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.is_active ? ' (ativa)' : ''}
            </option>
          ))}
        </select>
        {selectedSeason && (
          <span className="rounded bg-prank-surface-2 px-3 py-1 text-sm font-semibold text-prank-gold">
            Rodada {rounds.length} de {selectedSeason.total_rounds}
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto border-b border-prank-border pb-3">
        <button onClick={() => setTab('standings')} className={tabButtonClass(tab === 'standings')}>
          Classificação
        </button>
        {rounds.map((r) => (
          <button
            key={r.id}
            onClick={() => setTab(r.round_number)}
            className={tabButtonClass(tab === r.round_number)}
          >
            Rodada {r.round_number}
          </button>
        ))}
      </div>

      {loadingSeasonData ? (
        <p className="text-white/50">Carregando...</p>
      ) : tab === 'standings' ? (
        <StandingsTable rows={standings} />
      ) : (
        <RoundTable rows={roundResults[tab] ?? []} />
      )}

      <p className="mt-3 text-xs text-white/40">
        Pontuação: 3 pontos por vitória + 1 ponto de participação na rodada.
      </p>
    </div>
  );
}

function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0)
    return <p className="text-white/50">Nenhuma rodada lançada ainda nesta temporada.</p>;

  return (
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
  );
}

function RoundTable({ rows }: { rows: RoundResultRow[] }) {
  if (rows.length === 0)
    return <p className="text-white/50">Nenhum resultado lançado nessa rodada ainda.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-prank-border">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-prank-surface-2 text-xs uppercase tracking-wide text-white/50">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Jogador</th>
            <th className="px-4 py-3 text-center">W-L</th>
            <th className="px-4 py-3 text-right">Pontos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.player_name + i} className="border-t border-prank-border/60">
              <td className="px-4 py-3 font-display font-semibold text-prank-gold">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{r.player_name}</td>
              <td className="px-4 py-3 text-center text-white/70">
                {r.wins}-{r.losses}
              </td>
              <td className="px-4 py-3 text-right font-display text-lg font-bold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-prank-border/60 px-4 py-2 text-xs text-white/40">
        {rows.length} jogador{rows.length === 1 ? '' : 'es'} nessa rodada
      </p>
    </div>
  );
}

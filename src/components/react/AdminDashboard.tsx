import { useEffect, useState, type FormEvent } from 'react';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { base } from '../../lib/base';

type Tab = 'liga' | 'amistosos' | 'torneios' | 'fotos';

const inputClass =
  'w-full rounded-md border border-prank-border bg-prank-bg px-3 py-2 text-white outline-none focus:border-prank-gold';
const labelClass = 'mb-1 block text-sm text-white/60';
const cardClass = 'rounded-lg border border-prank-border bg-prank-surface p-5';
const buttonClass =
  'rounded-md bg-prank-purple px-4 py-2 font-display font-semibold text-white transition-colors hover:bg-prank-purple/80 disabled:opacity-50';
const deleteButtonClass = 'text-xs font-semibold text-red-400 hover:text-red-300';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('liga');

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = `${base}admin`;
        return;
      }
      setUserEmail(data.session.user.email ?? null);
      setReady(true);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = `${base}admin`;
  }

  if (!supabaseConfigured) {
    return (
      <p className="text-red-400">
        Site ainda sem conexão com o banco (configure as chaves do Supabase no .env).
      </p>
    );
  }

  if (!ready) return <p className="text-white/50">Carregando...</p>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'liga', label: 'Rodada da liga' },
    { id: 'amistosos', label: 'Amistoso' },
    { id: 'torneios', label: 'Torneio' },
    { id: 'fotos', label: 'Fotos' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          Logado como <span className="text-white">{userEmail}</span>
        </p>
        <button onClick={handleLogout} className="text-sm font-semibold text-white/60 hover:text-prank-gold">
          Sair
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-prank-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'rounded-md px-3 py-2 text-sm font-semibold ' +
              (tab === t.id
                ? 'bg-prank-purple text-white'
                : 'bg-prank-surface-2 text-white/60 hover:text-white')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'liga' && <LeagueRoundPanel />}
      {tab === 'amistosos' && <FriendlyPanel />}
      {tab === 'torneios' && <TournamentPanel />}
      {tab === 'fotos' && <PhotoPanel />}
    </div>
  );
}

// ---------- Liga ----------

interface Season {
  id: string;
  name: string;
  total_rounds: number;
  is_active: boolean;
}

interface Round {
  id: string;
  season_id: string;
  round_number: number;
  round_date: string;
}

interface ResultRow {
  id: string;
  player_id: string;
  wins: number;
  losses: number;
  points: number;
  league_players: { name: string } | null;
}

interface RosterPlayer {
  player_id: string;
  player_name: string;
}

interface RoundEntry {
  player_id: string;
  name: string;
  checked: boolean;
  wins: number;
  losses: number;
  resultId: string | null;
}

function buildRoundEntries(roster: RosterPlayer[], results: ResultRow[]): RoundEntry[] {
  return roster
    .map((p) => {
      const existing = results.find((r) => r.player_id === p.player_id);
      return {
        player_id: p.player_id,
        name: p.player_name,
        checked: Boolean(existing),
        wins: existing?.wins ?? 0,
        losses: existing?.losses ?? 0,
        resultId: existing?.id ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function LeagueRoundPanel() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [seasonName, setSeasonName] = useState('');
  const [seasonRounds, setSeasonRounds] = useState(8);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [seasonRoster, setSeasonRoster] = useState<RosterPlayer[]>([]);
  const [roundEntries, setRoundEntries] = useState<RoundEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [newRoundNumber, setNewRoundNumber] = useState(1);
  const [newRoundDate, setNewRoundDate] = useState(today());
  const [playerName, setPlayerName] = useState('');
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  async function loadSeasons() {
    const { data } = await supabase
      .from('league_seasons')
      .select('*')
      .order('created_at', { ascending: false });
    const list = (data as Season[]) ?? [];
    setSeasons(list);
    const active = list.find((s) => s.is_active) ?? null;
    setActiveSeason(active);
    return active;
  }

  async function loadRounds(seasonId: string) {
    const { data } = await supabase
      .from('league_rounds')
      .select('*')
      .eq('season_id', seasonId)
      .order('round_number', { ascending: false });
    const list = (data as Round[]) ?? [];
    setRounds(list);
    setNewRoundNumber((list[0]?.round_number ?? 0) + 1);
  }

  async function loadSeasonRoster(seasonId: string) {
    const { data } = await supabase
      .from('league_standings')
      .select('player_id, player_name')
      .eq('season_id', seasonId);
    const roster = (data as RosterPlayer[]) ?? [];
    setSeasonRoster(roster);
    return roster;
  }

  async function loadResults(roundId: string, roster: RosterPlayer[]) {
    const { data } = await supabase
      .from('league_results')
      .select('id, player_id, wins, losses, points, league_players(name)')
      .eq('round_id', roundId);
    const list = (data as unknown as ResultRow[]) ?? [];
    setRoundEntries(buildRoundEntries(roster, list));
  }

  useEffect(() => {
    loadSeasons().then((active) => {
      if (active) {
        loadRounds(active.id);
        loadSeasonRoster(active.id);
      }
    });
  }, []);

  async function createSeason(e: FormEvent) {
    e.preventDefault();
    setSeasonError(null);
    // garante que só existe uma temporada ativa por vez
    await supabase.from('league_seasons').update({ is_active: false }).eq('is_active', true);
    const { error: err } = await supabase
      .from('league_seasons')
      .insert({ name: seasonName, total_rounds: seasonRounds, is_active: true });
    if (err) {
      setSeasonError(err.message);
      return;
    }
    setSeasonName('');
    setSeasonRounds(8);
    setSelectedRound(null);
    setRoundEntries([]);
    const active = await loadSeasons();
    if (active) {
      loadRounds(active.id);
      loadSeasonRoster(active.id);
    }
  }

  async function endSeason() {
    if (!activeSeason) return;
    if (
      !confirm(
        `Encerrar "${activeSeason.name}"? Ela continua salva no histórico, mas sai da página pública e para de aceitar novas rodadas.`,
      )
    )
      return;
    await supabase.from('league_seasons').update({ is_active: false }).eq('id', activeSeason.id);
    setSelectedRound(null);
    setRoundEntries([]);
    setRounds([]);
    setSeasonRoster([]);
    loadSeasons();
  }

  async function createRound(e: FormEvent) {
    e.preventDefault();
    if (!activeSeason) return;
    setError(null);
    const { data, error: err } = await supabase
      .from('league_rounds')
      .insert({
        season_id: activeSeason.id,
        round_number: newRoundNumber,
        round_date: newRoundDate,
      })
      .select()
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    await loadRounds(activeSeason.id);
    setSelectedRound(data as Round);
    // rodada nova, sem resultados ainda — lista o elenco da temporada todo desmarcado
    setRoundEntries(buildRoundEntries(seasonRoster, []));
  }

  async function selectRound(round: Round) {
    setSelectedRound(round);
    await loadResults(round.id, seasonRoster);
  }

  async function deleteRound(round: Round) {
    if (!confirm(`Apagar a rodada ${round.round_number} e todos os resultados dela?`)) return;
    await supabase.from('league_rounds').delete().eq('id', round.id);
    if (selectedRound?.id === round.id) {
      setSelectedRound(null);
      setRoundEntries([]);
    }
    if (activeSeason) loadRounds(activeSeason.id);
  }

  function updateEntry(playerId: string, patch: Partial<RoundEntry>) {
    setRoundEntries((prev) =>
      prev.map((entry) => (entry.player_id === playerId ? { ...entry, ...patch } : entry)),
    );
  }

  async function saveRoundEntries() {
    if (!selectedRound) return;
    setError(null);
    setSaving(true);

    const toSave = roundEntries.filter((e) => e.checked);
    const toRemove = roundEntries.filter((e) => !e.checked && e.resultId);

    if (toSave.length > 0) {
      const { error: upsertErr } = await supabase.from('league_results').upsert(
        toSave.map((e) => ({
          round_id: selectedRound.id,
          player_id: e.player_id,
          wins: e.wins,
          losses: e.losses,
        })),
        { onConflict: 'round_id,player_id' },
      );
      if (upsertErr) {
        setError(upsertErr.message);
        setSaving(false);
        return;
      }
    }

    if (toRemove.length > 0) {
      const { error: deleteErr } = await supabase
        .from('league_results')
        .delete()
        .in(
          'id',
          toRemove.map((e) => e.resultId as string),
        );
      if (deleteErr) {
        setError(deleteErr.message);
        setSaving(false);
        return;
      }
    }

    await loadResults(selectedRound.id, seasonRoster);
    setSaving(false);
  }

  async function addResult(e: FormEvent) {
    e.preventDefault();
    if (!selectedRound || !activeSeason) return;
    setAddError(null);

    let playerId: string;
    const { data: existing } = await supabase
      .from('league_players')
      .select('id')
      .ilike('name', playerName.trim())
      .maybeSingle();

    if (existing) {
      playerId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from('league_players')
        .insert({ name: playerName.trim() })
        .select()
        .single();
      if (createErr) {
        setAddError(createErr.message);
        return;
      }
      playerId = created.id;
    }

    const { error: resultErr } = await supabase.from('league_results').upsert(
      { round_id: selectedRound.id, player_id: playerId, wins, losses },
      { onConflict: 'round_id,player_id' },
    );
    if (resultErr) {
      setAddError(resultErr.message);
      return;
    }

    setPlayerName('');
    setWins(0);
    setLosses(0);
    const roster = await loadSeasonRoster(activeSeason.id);
    loadResults(selectedRound.id, roster);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">Temporada</h3>
            {activeSeason ? (
              <p className="text-sm text-white/60">
                Ativa: <span className="text-prank-gold">{activeSeason.name}</span> ·{' '}
                {rounds.length} de {activeSeason.total_rounds} rodadas lançadas
              </p>
            ) : (
              <p className="text-sm text-white/60">Nenhuma temporada ativa no momento.</p>
            )}
          </div>
          {activeSeason && (
            <button onClick={endSeason} className={deleteButtonClass}>
              Encerrar temporada
            </button>
          )}
        </div>

        {!activeSeason && (
          <form onSubmit={createSeason} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1">
              <label className={labelClass}>Nome da temporada</label>
              <input
                required
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                className={inputClass}
                placeholder="Ex: Temporada 1"
              />
            </div>
            <div className="w-32">
              <label className={labelClass}>Nº de rodadas</label>
              <input
                type="number"
                min={1}
                required
                value={seasonRounds}
                onChange={(e) => setSeasonRounds(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <button type="submit" className={buttonClass}>
              Iniciar temporada
            </button>
          </form>
        )}
        {seasonError && <p className="mt-2 text-sm text-red-400">{seasonError}</p>}

        {seasons.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60">
              Ver todas as temporadas ({seasons.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-white/60">
              {seasons.map((s) => (
                <li key={s.id}>
                  {s.name} — {s.total_rounds} rodadas {s.is_active ? '(ativa)' : '(encerrada)'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {activeSeason && (
        <div className="flex flex-col gap-6 md:flex-row">
          <div className={cardClass + ' md:w-80 md:flex-none'}>
            <h3 className="font-display mb-3 text-lg font-semibold">Nova rodada</h3>
            <form onSubmit={createRound} className="flex flex-col gap-3">
              <div>
                <label className={labelClass}>Número da rodada</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newRoundNumber}
                  onChange={(e) => setNewRoundNumber(Number(e.target.value))}
                  className={inputClass}
                />
                {newRoundNumber > activeSeason.total_rounds && (
                  <p className="mt-1 text-xs text-amber-400">
                    Essa temporada tem {activeSeason.total_rounds} rodadas previstas.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Data</label>
                <input
                  type="date"
                  required
                  value={newRoundDate}
                  onChange={(e) => setNewRoundDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button type="submit" className={buttonClass}>
                Criar rodada
              </button>
            </form>

            <h4 className="mt-6 mb-2 text-sm font-semibold text-white/50">
              Rodadas desta temporada
            </h4>
            <ul className="flex flex-col gap-1">
              {rounds.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <button
                    onClick={() => selectRound(r)}
                    className={
                      'flex-1 rounded px-2 py-1 text-left hover:bg-prank-surface-2 ' +
                      (selectedRound?.id === r.id ? 'bg-prank-surface-2 text-prank-gold' : '')
                    }
                  >
                    Rodada {r.round_number} ·{' '}
                    {new Date(r.round_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </button>
                  <button onClick={() => deleteRound(r)} className={deleteButtonClass}>
                    excluir
                  </button>
                </li>
              ))}
              {rounds.length === 0 && (
                <p className="text-sm text-white/40">Nenhuma rodada criada ainda.</p>
              )}
            </ul>
          </div>

          <div className={cardClass + ' flex-1'}>
            {!selectedRound ? (
              <p className="text-white/50">
                Crie ou selecione uma rodada à esquerda para lançar os resultados dos jogadores.
              </p>
            ) : (
              <>
                <h3 className="font-display mb-3 text-lg font-semibold">
                  Resultados · Rodada {selectedRound.round_number}
                </h3>

                {roundEntries.length === 0 ? (
                  <p className="mb-4 text-sm text-white/40">
                    Nenhum jogador na temporada ainda. Cadastre o primeiro no formulário abaixo.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-white/40">
                      Marque quem jogou essa rodada e ajusta o placar. Quem não jogou fica
                      desmarcado e não soma ponto nenhum.
                    </p>
                    <div className="mb-4 overflow-x-auto rounded-lg border border-prank-border">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <thead className="bg-prank-surface-2 text-xs uppercase tracking-wide text-white/50">
                          <tr>
                            <th className="px-3 py-2">Jogou</th>
                            <th className="px-3 py-2">Jogador</th>
                            <th className="px-3 py-2 text-center">V</th>
                            <th className="px-3 py-2 text-center">D</th>
                            <th className="px-3 py-2 text-right">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roundEntries.map((entry) => (
                            <tr key={entry.player_id} className="border-t border-prank-border/60">
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={entry.checked}
                                  onChange={(e) =>
                                    updateEntry(entry.player_id, { checked: e.target.checked })
                                  }
                                  className="h-4 w-4 accent-prank-purple"
                                />
                              </td>
                              <td
                                className={'px-3 py-2 ' + (entry.checked ? '' : 'text-white/40')}
                              >
                                {entry.name}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={!entry.checked}
                                  value={entry.wins}
                                  onChange={(e) =>
                                    updateEntry(entry.player_id, { wins: Number(e.target.value) })
                                  }
                                  className="w-14 rounded border border-prank-border bg-prank-bg px-2 py-1 text-center text-white outline-none focus:border-prank-gold disabled:opacity-30"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={!entry.checked}
                                  value={entry.losses}
                                  onChange={(e) =>
                                    updateEntry(entry.player_id, {
                                      losses: Number(e.target.value),
                                    })
                                  }
                                  className="w-14 rounded border border-prank-border bg-prank-bg px-2 py-1 text-center text-white outline-none focus:border-prank-gold disabled:opacity-30"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-display font-semibold text-prank-gold">
                                {entry.checked ? entry.wins * 3 + 1 : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
                    <button
                      type="button"
                      onClick={saveRoundEntries}
                      disabled={saving}
                      className={buttonClass}
                    >
                      {saving ? 'Salvando...' : 'Salvar rodada'}
                    </button>
                  </>
                )}

                <h4 className="mt-6 mb-2 text-sm font-semibold text-white/50">
                  Jogador novo nesta rodada
                </h4>
                <form onSubmit={addResult} className="flex flex-col gap-3">
                  <div>
                    <label className={labelClass}>Nome do jogador</label>
                    <input
                      required
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className={inputClass}
                      placeholder="Ex: Bruno"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Vitórias</label>
                      <input
                        type="number"
                        min={0}
                        value={wins}
                        onChange={(e) => setWins(Number(e.target.value))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Derrotas</label>
                      <input
                        type="number"
                        min={0}
                        value={losses}
                        onChange={(e) => setLosses(Number(e.target.value))}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-white/40">
                    Pontos calculados automaticamente: <strong>{wins * 3 + 1}</strong> (3 por
                    vitória + 1 de participação)
                  </p>
                  {addError && <p className="text-sm text-red-400">{addError}</p>}
                  <button type="submit" className={buttonClass}>
                    Adicionar à rodada
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Amistosos ----------

interface Friendly {
  id: string;
  opponent_team: string;
  played_at: string;
  our_score: number;
  their_score: number;
  notes: string | null;
}

function FriendlyPanel() {
  const [rows, setRows] = useState<Friendly[]>([]);
  const [opponent, setOpponent] = useState('');
  const [playedAt, setPlayedAt] = useState(today());
  const [ourScore, setOurScore] = useState(0);
  const [theirScore, setTheirScore] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('friendlies')
      .select('*')
      .order('played_at', { ascending: false });
    setRows((data as Friendly[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.from('friendlies').insert({
      opponent_team: opponent,
      played_at: playedAt,
      our_score: ourScore,
      their_score: theirScore,
      notes: notes || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setOpponent('');
    setOurScore(0);
    setTheirScore(0);
    setNotes('');
    load();
  }

  async function remove(id: string) {
    await supabase.from('friendlies').delete().eq('id', id);
    load();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={cardClass}>
        <h3 className="font-display mb-3 text-lg font-semibold">Novo amistoso</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Time adversário</label>
            <input required value={opponent} onChange={(e) => setOpponent(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Data</label>
            <input
              type="date"
              required
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Nosso placar</label>
              <input
                type="number"
                min={0}
                value={ourScore}
                onChange={(e) => setOurScore(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Placar deles</label>
              <input
                type="number"
                min={0}
                value={theirScore}
                onChange={(e) => setTheirScore(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Observações (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={2} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className={buttonClass}>
            Salvar amistoso
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h3 className="font-display mb-3 text-lg font-semibold">Amistosos lançados</h3>
        <ul className="flex flex-col gap-2">
          {rows.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded bg-prank-surface-2 px-3 py-2 text-sm">
              <span>
                vs {f.opponent_team} — {f.our_score}x{f.their_score} (
                {new Date(f.played_at + 'T00:00:00').toLocaleDateString('pt-BR')})
              </span>
              <button onClick={() => remove(f.id)} className={deleteButtonClass}>
                excluir
              </button>
            </li>
          ))}
          {rows.length === 0 && <p className="text-sm text-white/40">Nenhum amistoso ainda.</p>}
        </ul>
      </div>
    </div>
  );
}

// ---------- Torneios ----------

interface Tournament {
  id: string;
  name: string;
  event_date: string;
  location: string | null;
  format: string | null;
  link: string | null;
  notes: string | null;
}

function TournamentPanel() {
  const [rows, setRows] = useState<Tournament[]>([]);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState(today());
  const [location, setLocation] = useState('');
  const [format, setFormat] = useState('');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('tournaments').select('*').order('event_date', { ascending: true });
    setRows((data as Tournament[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.from('tournaments').insert({
      name,
      event_date: eventDate,
      location: location || null,
      format: format || null,
      link: link || null,
      notes: notes || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setName('');
    setLocation('');
    setFormat('');
    setLink('');
    setNotes('');
    load();
  }

  async function remove(id: string) {
    await supabase.from('tournaments').delete().eq('id', id);
    load();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={cardClass}>
        <h3 className="font-display mb-3 text-lg font-semibold">Novo torneio</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Nome do torneio</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Data</label>
            <input
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Local (opcional)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Formato (opcional)</label>
            <input
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className={inputClass}
              placeholder="Ex: Regulation I, Bo3"
            />
          </div>
          <div>
            <label className={labelClass}>Link (opcional)</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Observações (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={2} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className={buttonClass}>
            Salvar torneio
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h3 className="font-display mb-3 text-lg font-semibold">Torneios cadastrados</h3>
        <ul className="flex flex-col gap-2">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded bg-prank-surface-2 px-3 py-2 text-sm">
              <span>
                {t.name} ({new Date(t.event_date + 'T00:00:00').toLocaleDateString('pt-BR')})
              </span>
              <button onClick={() => remove(t.id)} className={deleteButtonClass}>
                excluir
              </button>
            </li>
          ))}
          {rows.length === 0 && <p className="text-sm text-white/40">Nenhum torneio ainda.</p>}
        </ul>
      </div>
    </div>
  );
}

// ---------- Fotos ----------

interface Photo {
  id: string;
  image_path: string;
  caption: string | null;
  event_date: string | null;
}

function PhotoPanel() {
  const [rows, setRows] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [eventDate, setEventDate] = useState(today());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('gallery_photos').select('*').order('created_at', { ascending: false });
    setRows((data as Photo[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);

    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { error: uploadErr } = await supabase.storage.from('gallery').upload(path, file);
    if (uploadErr) {
      setError(uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from('gallery_photos').insert({
      image_path: path,
      caption: caption || null,
      event_date: eventDate || null,
    });
    setUploading(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    setFile(null);
    setCaption('');
    load();
  }

  async function remove(photo: Photo) {
    await supabase.storage.from('gallery').remove([photo.image_path]);
    await supabase.from('gallery_photos').delete().eq('id', photo.id);
    load();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={cardClass}>
        <h3 className="font-display mb-3 text-lg font-semibold">Nova foto</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Arquivo</label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Legenda (opcional)</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Data do evento (opcional)</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={uploading} className={buttonClass}>
            {uploading ? 'Enviando...' : 'Publicar foto'}
          </button>
        </form>
      </div>

      <div className={cardClass}>
        <h3 className="font-display mb-3 text-lg font-semibold">Fotos publicadas</h3>
        <ul className="flex flex-col gap-2">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded bg-prank-surface-2 px-3 py-2 text-sm">
              <span className="truncate">{p.caption || p.image_path}</span>
              <button onClick={() => remove(p)} className={deleteButtonClass}>
                excluir
              </button>
            </li>
          ))}
          {rows.length === 0 && <p className="text-sm text-white/40">Nenhuma foto ainda.</p>}
        </ul>
      </div>
    </div>
  );
}

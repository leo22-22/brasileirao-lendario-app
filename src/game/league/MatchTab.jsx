// Aba Partida da liga clássica — liga-partida-mockup.html. Só apresentação:
// recebe o estado do jogo pronto do App.jsx (eventos já revelados pelo
// tick, placar, minuto, resultados da rodada) e devolve as ações pelos
// mesmos handlers. Antes do jogo usa a prévia única (MatchPreviewCard);
// durante e depois, o jogo ao vivo único (LiveMatchView).
import { ClubCrest } from '../../components/football/ClubCrest.jsx';
import { MiniStandings } from '../../components/football/StandingsTable.jsx';
import { MatchPreviewCard, RoundGames } from '../../components/football/MatchPreviewCard.jsx';
import { LiveScoreboard, LiveFeed, LiveSeg, LiveButton } from '../../components/football/LiveMatchView.jsx';
import './matchTab.css';

const MODES = [{ id: 'manual', label: 'Manual' }, { id: 'auto', label: 'Auto' }];
const SPEEDS = [{ id: 1, label: '1x' }, { id: 1.5, label: '1,5x' }, { id: 2, label: '2x' }];

/**
 * status: 'pre' | 'live' | 'paused' | 'done'
 * home/away: { id, label, logo, badge, color, mine, sub, form, raw }
 * otherGames: [{ key, home, away, score: { h, a } | null }] (home/away: { label, logo, color })
 * liveTable: { rows: [{ row, pos, move, zone, label } | { gap, key }], myId, title, note }
 */
export function MatchTab({
  roundNumber, venueText, isClassic, home, away, status, score, minute, events = [], probs,
  simMode, onSetSimMode, simSpeed, onSetSpeed, onPause, onResume, onStart, startLabel, autoCountdown, onSimulateAll, onViewTeam,
  subPanel, children, otherGames = [], otherNote, liveTable, onOpenTable,
}) {
  const live = status === 'live' || status === 'paused';
  const crest = (t, size) => <ClubCrest logo={t.logo} badge={t.badge} name={t.label} color={t.color} size={size} frame scale={0.68} frameClass={`fb-crest-frame fb-lv-crest${t.mine ? ' fb-lv-crest-mine' : ''}`} />;
  const eyebrow = `Rodada ${roundNumber}${venueText ? ` · ${venueText}` : ''}`;
  return (
    <div className="lg-lay">
      <div className="lg-lc">
        {status === 'pre' ? (
          <MatchPreviewCard
            size="md"
            eyebrow={eyebrow}
            eyebrowRight={isClassic ? 'Clássico' : null}
            onOpen={onViewTeam ? () => onViewTeam((home.mine ? away : home).raw) : undefined}
            openTitle="Ver elenco do adversário"
            home={{ crest: crest(home, 64), name: home.label, sub: home.sub, form: home.form }}
            away={{ crest: crest(away, 64), name: away.label, sub: away.sub, form: away.form }}
            probs={probs ? { home: probs.homeWin, draw: probs.draw, away: probs.awayWin } : null}
            probsNote="Pela força dos elencos, antes da forma recente."
            actions={(
              <>
                <LiveSeg label="Modo de avanço" options={MODES} value={simMode} onChange={onSetSimMode} />
                {simMode !== 'auto' && <LiveButton icon="play" grow onClick={onStart}>{startLabel}</LiveButton>}
                {simMode === 'auto' && autoCountdown !== null && <span className="fb-lv-cd" role="status">Começa em <b>{autoCountdown}s</b></span>}
                {onSimulateAll && (
                  <LiveButton tone="ghost" icon="forward" full onClick={onSimulateAll} title="Avança todas as rodadas restantes, inclusive as suas, sem parar para jogar cada uma">
                    Simulação direta — ir até o fim
                  </LiveButton>
                )}
              </>
            )}
          />
        ) : (
          <LiveScoreboard
            eyebrow={eyebrow}
            badges={isClassic ? <span className="fb-lv-classic">Clássico</span> : null}
            status={status}
            home={{ id: home.id, name: home.label, crest: crest(home, 64), sub: home.sub, mine: home.mine, raw: home.raw }}
            away={{ id: away.id, name: away.label, crest: crest(away, 64), sub: away.sub, mine: away.mine, raw: away.raw }}
            score={score}
            minute={minute}
            events={events}
            onViewTeam={onViewTeam}
            controls={(
              <>
                <LiveSeg label="Modo de avanço" options={MODES} value={simMode} onChange={onSetSimMode} />
                {live && <LiveSeg label="Velocidade" options={SPEEDS} value={simSpeed} onChange={onSetSpeed} />}
                {status === 'live' && <LiveButton icon="clock" onClick={onPause}>Pausar</LiveButton>}
                {status === 'paused' && <LiveButton icon="play" onClick={onResume}>Continuar</LiveButton>}
              </>
            )}
          />
        )}

        {subPanel}

        {status !== 'pre' && (
          <LiveFeed events={events} homeId={home.id} homeName={home.label} awayName={away.label} minute={minute} status={status} />
        )}

        {children}
      </div>

      <div className="lg-side-col">
        {otherGames.length > 0 && (
          <section className="lg-card">
            <div className="lg-ch"><h3>Outros jogos</h3><span className="lg-small">{otherNote}</span></div>
            <RoundGames games={otherGames.map(g => ({
              key: g.key,
              home: { name: g.home.label, crest: <ClubCrest logo={g.home.logo} badge={g.home.badge} name={g.home.label} color={g.home.color} size={18} /> },
              away: { name: g.away.label, crest: <ClubCrest logo={g.away.logo} badge={g.away.badge} name={g.away.label} color={g.away.color} size={18} /> },
              score: g.score,
              status: g.score ? 'played' : 'pending',
            }))} />
          </section>
        )}

        {liveTable && (
          <section className="lg-card">
            <div className="lg-ch"><h3>{liveTable.title}</h3>{onOpenTable && <button type="button" className="lg-link" onClick={onOpenTable}>Completa</button>}</div>
            <MiniStandings rows={liveTable.rows} myId={liveTable.myId} title={liveTable.title} />
            {liveTable.note && <div className="lg-note">{liveTable.note}</div>}
          </section>
        )}
      </div>
    </div>
  );
}

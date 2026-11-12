// Home redesign (tema claro) — corpo da home a partir do hero (o cabeçalho
// continua em App.jsx, só restilizado pra claro quando `isHomeLight`). Quem
// chama isso é o `Intro` (App.jsx), que continua dono dos modais
// (ClubHistoryModal/AchievementsModal/WeeklyTeamModal/ModeDifficultyModal) e
// repassa pra cá só callbacks pra abri-los — ver comentário no topo do
// `Intro` em App.jsx. Nada aqui inventa dado: tudo vem de props (TEAMS/
// CLUB_LOGOS/lib/format.js são importados direto, por serem módulos-folha
// sem dependência de volta pro App.jsx).
import { useState, useMemo } from 'react';
import { TEAMS } from '../data/teams.js';
import { CLUB_LOGOS } from '../data/club-logos.js';
import { hexToRgba, parseTeamLabel } from '../lib/format.js';
import './home.css';

function ArrowIcon({ color }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const MODE_ICON_PATHS = {
  serieab: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" /><path d="M12 13v4M8.5 20h7" /></>,
  copa: <><path d="M4 5h5v5H4zM4 14h5v5H4zM9 7.5h4v9H9M13 12h7" /></>,
  atual2026: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  sim2026: <path d="M3 12h3l3-7 4 14 3-7h5" />,
  livre: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  amigos: <><circle cx="9" cy="9" r="3.5" /><circle cx="17" cy="10" r="2.5" /><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5M15 14.5c2.5 0 4.6 1.5 5.5 4.5" /></>,
  supercopa: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
};
function ModeIcon({ id, color = '#0D3A29', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {MODE_ICON_PATHS[id]}
    </svg>
  );
}

const ERA_BUCKETS = [
  { key: 'all', label: 'Todas as eras', test: () => true },
  { key: '60s', label: 'Anos 60', test: y => y < 1970 },
  { key: '70s', label: 'Anos 70', test: y => y >= 1970 && y < 1980 },
  { key: '80s', label: 'Anos 80', test: y => y >= 1980 && y < 1990 },
  { key: '90s', label: 'Anos 90', test: y => y >= 1990 && y < 2000 },
  { key: '2000s', label: 'Anos 2000', test: y => y >= 2000 && y < 2010 },
  { key: '2010s', label: 'Anos 2010', test: y => y >= 2010 && y < 2020 },
  { key: '2020s', label: '2020 — 2026', test: y => y >= 2020 },
];
const TEAMS_PER_ERA = 8;

// Mesma lógica de posicionamento do campinho do WeeklyTeamModal (App.jsx) —
// reaproveitada aqui via props (weekRoleInfo/weekLineTopPct), igual o
// pedido do usuário ("reaproveite WEEK_ROLE_INFO / WEEK_LINE_TOP_PCT").
function useWeeklyPitch(weeklyTeam, weekRoleInfo) {
  return useMemo(() => {
    const enriched = weeklyTeam.players.map(wp => {
      const team = TEAMS.find(t => t.id === wp.teamId);
      const player = team?.players.find(p => p.name === wp.name);
      const info = weekRoleInfo[wp.posLabel] || { line: 3, abbr: (wp.posLabel || '').slice(0, 3).toUpperCase() };
      return { ...wp, team, player, ...info };
    });
    const byLine = {};
    enriched.forEach(p => { (byLine[p.line] ||= []).push(p); });
    return byLine;
  }, [weeklyTeam, weekRoleInfo]);
}

export function HomeLanding({
  onStart, onSetGameMode, myTeamColor, myTeamLogo, myTeamBadge, currentUser,
  onMultiPlayer, onNavigateInfo, onNavigateTeams, onOpenSerieAtual, onOpenSimulator2026,
  livreTeamIds, onClearLivre, onOpenLivrePicker, onOpenCareer,
  dailyChallenge, dailyChallengeAlreadyPlayed, onOpenDailyChallenge,
  careerLocked, careerLaunchDismissed, onDismissCareerLaunch,
  weeklyTeam, weeklyCraque, weekRoleInfo, weekLineTopPct,
  gameStats, achievementsTotal, featuredAchievementIds, AchievementProgressCard,
  onOpenClub, onOpenAchievements, onOpenWeeklyTeam, onPickMode,
}) {
  const mc = myTeamColor || '#C29A45';
  const [era, setEra] = useState('all');

  const lines = useWeeklyPitch(weeklyTeam, weekRoleInfo);

  const serieABMode = {
    id: 'serieab', color: mc, title: 'Brasileirão Lendário', sub: '40 times · Série A e B',
    onConfirm: () => { onSetGameMode('serieab'); onClearLivre(); onStart(); },
  };
  const modeCards = [
    serieABMode,
    { id: 'copa', color: '#5dade2', title: 'Copa do Brasil Lendária', sub: '32 times · Mata-mata', onConfirm: () => { onSetGameMode('copa'); onClearLivre(); onStart(); } },
    { id: 'atual2026', color: '#e8a33d', title: 'Brasileirão Atual', sub: '20 times reais · 2026', onConfirm: () => onOpenSerieAtual() },
    { id: 'sim2026', color: '#e05050', title: 'Simulador do Brasileirão 2026', sub: 'Rodada 35 em diante · todos os jogos', skipDifficulty: true, onConfirm: () => onOpenSimulator2026() },
  ];

  const eraTeams = useMemo(() => {
    const bucket = ERA_BUCKETS.find(e => e.key === era) || ERA_BUCKETS[0];
    return TEAMS.filter(t => bucket.test(t.year)).slice(0, TEAMS_PER_ERA);
  }, [era]);

  return (
    <div className="hl-home" style={{ width: '100%', maxWidth: 1240, margin: '0 auto' }}>
      {/* ── Hero ── */}
      <div className="hl-hero">
        <div>
          <span className="hl-eyebrow hl-mono"><i /> Futebol brasileiro · 1959 — 2026</span>
          <h1 className="hl-h1">Monte o time <em>lendário</em> dos seus sonhos.</h1>
          <p className="hl-lead">
            Sorteie os maiores times campeões do Brasileirão, escolha os melhores jogadores de cada era
            e dispute uma liga completa com cronômetro ao vivo.
          </p>
          <div className="hl-cta">
            <button className="hl-btn hl-dark" onClick={() => onPickMode(serieABMode)}>
              Começar a jogar <ArrowIcon color="#fff" />
            </button>
            <button className="hl-btn hl-ghost" onClick={onMultiPlayer}>Jogar com amigos</button>
          </div>
          <div className="hl-stats">
            <div><b>{new Set(TEAMS.map(t => t.club)).size}</b><span>clubes</span></div>
            <div><b>{gameStats.squads}</b><span>elencos históricos</span></div>
            <div><b>{gameStats.players.toLocaleString('pt-BR')}</b><span>jogadores</span></div>
          </div>
        </div>

        <div className="hl-hero-art">
          <button className="hl-pitchcard" onClick={onOpenWeeklyTeam}>
            <div className="hl-pc-head">
              <div className="hl-t">Seleção da {weeklyTeam.label}<small>os 11 melhores da rodada</small></div>
            </div>
            <div className="hl-field">
              {Object.entries(lines).map(([line, linePlayers]) => linePlayers.map((p, i) => {
                const leftPct = ((i + 1) / (linePlayers.length + 1)) * 100;
                const topPct = weekLineTopPct[line] ?? 50;
                const isCraque = !!p.craque;
                return (
                  <div key={p.teamId + p.name} className={`hl-p${isCraque ? ' hl-gold' : ''}`} style={{ left: `${leftPct}%`, top: `${topPct}%` }}>
                    <div className="hl-dot">
                      {p.team && CLUB_LOGOS[p.team.club]
                        ? <img src={CLUB_LOGOS[p.team.club]} alt="" />
                        : p.abbr}
                    </div>
                    <span className="hl-n">{isCraque ? '👑 ' : ''}{p.name}</span>
                  </div>
                );
              }))}
            </div>
          </button>
          <div className="hl-hero-floats">
            {weeklyCraque && (
              <button className="hl-float hl-a" onClick={onOpenWeeklyTeam}>
                <div className="hl-k">Seleção da {weeklyTeam.label}</div>
                <div className="hl-v">{weeklyCraque.name} é o craque</div>
              </button>
            )}
            {dailyChallenge && (
              <button
                className="hl-float hl-b"
                onClick={() => !dailyChallengeAlreadyPlayed && onOpenDailyChallenge()}
                style={dailyChallengeAlreadyPlayed ? { cursor: 'default', opacity: 0.75 } : undefined}
              >
                <div className="hl-k">Supercopa do dia</div>
                <div className="hl-v">
                  {dailyChallengeAlreadyPlayed
                    ? 'Feita hoje ✅'
                    : `vs. ${parseTeamLabel(dailyChallenge.opponent.label).baseName}`}
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Faixa "Modo Carreira no ar" ── */}
      {!careerLocked && !careerLaunchDismissed && (
        <button className="hl-note hl-card-hover" onClick={onOpenCareer}>
          <div className="hl-l">
            <span className="hl-tag hl-mono">Novo</span>
            <p><b>O Modo Carreira está no ar.</b> Elencos reais dos 40 clubes da Série A e B, com orçamento, transferências e base.</p>
          </div>
          <span className="hl-arrow" onClick={e => e.stopPropagation()}>
            <span className="hl-note-close" onClick={e => { e.stopPropagation(); onDismissCareerLaunch(); }} aria-label="Fechar aviso">×</span>
            Conhecer <ArrowIcon />
          </span>
        </button>
      )}

      {/* ── Escolha o modo ── */}
      <section className="hl-section">
        <div className="hl-sh">
          <div>
            <span className="hl-eyebrow hl-mono"><i /> Escolha o modo</span>
            <h2 className="hl-h2">Sete jeitos de<br />fazer <em>história</em>.</h2>
          </div>
          <p>Do draft clássico com lendas de 1959 à temporada atual do Brasileirão — sozinho ou com até 32 amigos.</p>
        </div>

        <div className="hl-modes">
          <button
            className={`hl-mode hl-feat${careerLocked ? ' hl-locked' : ''} hl-card-hover`}
            onClick={() => !careerLocked && onOpenCareer()}
          >
            <span className="hl-bigring" /><span className="hl-bigring hl-r2" />
            <div>
              <span className="hl-tag hl-mono">{careerLocked ? 'Em manutenção' : 'Novo'}</span>
              <h3>Modo Carreira</h3>
              <p>{careerLocked
                ? 'Voltando em breve com mais melhorias. Sua carreira salva não foi perdida.'
                : 'Assuma um clube real e construa uma dinastia ao longo das temporadas.'}</p>
              {!careerLocked && (
                <div className="hl-feat-list">
                  <span>40 clubes 100% reais · Série A e B</span>
                  <span>Orçamento e mercado de transferências</span>
                  <span>Copa do Brasil e categoria de base</span>
                </div>
              )}
            </div>
            {!careerLocked && <span className="hl-btn hl-gold" style={{ marginTop: 6, alignSelf: 'flex-start' }}>Iniciar carreira <ArrowIcon color="#fff" /></span>}
          </button>

          {modeCards.map(m => (
            <button
              key={m.id}
              className="hl-mode hl-card-hover"
              onClick={() => (m.skipDifficulty ? m.onConfirm() : onPickMode(m))}
            >
              <div>
                <div className="hl-ic"><ModeIcon id={m.id} /></div>
                <h3>{m.title}</h3>
                <p>{m.id === 'serieab' ? 'Pontos corridos com os maiores campeões de todas as eras.'
                  : m.id === 'copa' ? 'Mata-mata sem margem para erro. Um jogo ruim e acabou.'
                  : m.id === 'atual2026' ? 'Os 20 clubes da Série A 2026 com elencos atualizados.'
                  : 'Simule o restante do campeonato, jogo a jogo.'}</p>
              </div>
              <div className="hl-meta"><span>{m.sub}</span><ArrowIcon /></div>
            </button>
          ))}
        </div>

        <div className="hl-minimodes">
          <button className="hl-mini hl-card-hover" onClick={onOpenLivrePicker}>
            <div className="hl-l">
              <div className="hl-ic"><ModeIcon id="livre" size={18} /></div>
              <div><h4>Modo Livre</h4><small>{livreTeamIds ? `${livreTeamIds.length} times escolhidos` : 'Escolha 16 times do seu jeito'}</small></div>
            </div>
            <ArrowIcon />
          </button>
          <button className="hl-mini hl-card-hover" onClick={onMultiPlayer}>
            <div className="hl-l">
              <div className="hl-ic"><ModeIcon id="amigos" size={18} /></div>
              <div><h4>Jogar com Amigos</h4><small>Sala por código · até 32 jogadores</small></div>
            </div>
            <ArrowIcon />
          </button>
          <button
            className="hl-mini hl-card-hover"
            onClick={() => !dailyChallengeAlreadyPlayed && onOpenDailyChallenge()}
            style={dailyChallengeAlreadyPlayed ? { cursor: 'default', opacity: 0.7 } : undefined}
          >
            <div className="hl-l">
              <div className="hl-ic"><ModeIcon id="supercopa" size={18} /></div>
              <div><h4>Supercopa</h4><small>{dailyChallengeAlreadyPlayed ? 'Jogada hoje ✅' : 'Campeões frente a frente'}</small></div>
            </div>
            <ArrowIcon />
          </button>
        </div>
      </section>

      {/* ── Meu clube ── */}
      <section className="hl-section" style={{ paddingTop: 64 }}>
        {currentUser ? (
          <div>
            <button className="hl-club-card hl-card-hover" onClick={onOpenClub} style={{ marginBottom: 20 }}>
              {myTeamLogo
                ? <img src={myTeamLogo} alt="" style={{ width: 44, height: 44, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />
                : <span style={{ width: 44, height: 44, borderRadius: 11, background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.3)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{myTeamBadge || '⭐'}</span>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 500, color: mc }}>Ver meu Clube</div>
                <div style={{ fontSize: 12, color: 'var(--hl-muted)', marginTop: 2 }}>
                  {(currentUser.titles_brasileirao || 0) + (currentUser.titles_copa || 0)} títulos · {currentUser.seasons_played || 0} temporadas · histórico completo
                </div>
              </div>
              <ArrowIcon color="#3A463F" />
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div className="hl-serif" style={{ fontSize: 17, fontWeight: 500 }}>Conquistas em destaque</div>
              <button onClick={onOpenAchievements} style={{ background: 'none', border: 'none', color: mc, fontSize: 12.5, cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                Ver todas ({achievementsTotal}) →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {featuredAchievementIds.map(id => (
                <AchievementProgressCard key={id} id={id} user={currentUser} unlockedSet={new Set(currentUser.achievements || [])} light />
              ))}
            </div>
          </div>
        ) : (
          <div className="hl-guest-note">
            Crie uma conta pra acompanhar seus objetivos de carreira e o histórico do seu clube.
          </div>
        )}
      </section>

      {/* ── Como funciona ── */}
      <section className="hl-section">
        <div className="hl-sh">
          <div>
            <span className="hl-eyebrow hl-mono"><i /> Como funciona</span>
            <h2 className="hl-h2">Três passos até a <em>taça</em>.</h2>
          </div>
        </div>
        <div className="hl-steps">
          <div className="hl-step"><div className="hl-num">01</div><h3>Role o dado</h3><p>Sorteie times campeões lendários. Não gostou? Recuse até três e tente de novo.</p></div>
          <div className="hl-step"><div className="hl-num">02</div><h3>Monte o plantel</h3><p>Escolha 11 titulares e 5 reservas entre os maiores craques de cada era.</p></div>
          <div className="hl-step"><div className="hl-num">03</div><h3>Dispute o título</h3><p>Liga com 20 times e 38 rodadas, com os gols aparecendo minuto a minuto.</p></div>
        </div>
      </section>

      {/* ── Acervo de times ── */}
      <section className="hl-section">
        <div className="hl-sh">
          <div>
            <span className="hl-eyebrow hl-mono"><i /> O acervo</span>
            <h2 className="hl-h2">{TEAMS.length} elencos que<br />marcaram <em>época</em>.</h2>
          </div>
          <button className="hl-btn hl-ghost" onClick={onNavigateTeams}>Ver todos os elencos</button>
        </div>
        <div className="hl-eras">
          {ERA_BUCKETS.map(e => (
            <button key={e.key} className={`hl-era${era === e.key ? ' hl-on' : ''}`} onClick={() => setEra(e.key)}>{e.label}</button>
          ))}
        </div>
        {eraTeams.length === 0 ? (
          <div className="hl-empty-note">Nenhum elenco nessa era ainda.</div>
        ) : (
          <div className="hl-teams">
            {eraTeams.map(t => {
              const { achievement } = parseTeamLabel(t.label);
              const p = t.colors?.p || '#1a1a1a';
              const s = t.colors?.s || '#2b2b2b';
              return (
                <div key={t.id} className="hl-team">
                  <div className="hl-band" style={{ background: `linear-gradient(0deg, rgba(0,0,0,0.38), rgba(0,0,0,0) 65%), linear-gradient(135deg, ${p} 0 55%, ${s} 55%)` }}>
                    {CLUB_LOGOS[t.club] && <img src={CLUB_LOGOS[t.club]} alt="" className="hl-crest" />}
                    <span className="hl-yr">{t.year}</span>
                  </div>
                  <div className="hl-body">
                    <h4>{t.club}</h4>
                    <p>{achievement || ' '}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── CTA final ── */}
      <div className="hl-band-cta">
        <span className="hl-bigring" style={{ right: -80, bottom: -160, width: 420, height: 420 }} />
        <span className="hl-bigring hl-r2" style={{ right: 10, bottom: -50 }} />
        <div>
          <h2>A próxima lenda do Brasileirão <em>é a sua</em>.</h2>
          <p>Grátis, direto no navegador. Crie uma conta para salvar sua carreira.</p>
        </div>
        <button className="hl-btn hl-gold" style={{ height: 52, padding: '0 26px', fontSize: 15, position: 'relative', flexShrink: 0 }} onClick={() => onPickMode(serieABMode)}>
          Começar a jogar <ArrowIcon color="#fff" />
        </button>
      </div>

      {/* ── Rodapé ── */}
      <div className="hl-footer">
        <span>© 2026 Brasileirão Lendário</span>
        <div className="hl-fl">
          {[['como-jogar', 'Como Jogar'], ['termos', 'Termos de Uso'], ['privacidade', 'Política de Privacidade'], ['contato', 'Contato']].map(([id, label]) => (
            <button key={id} onClick={() => onNavigateInfo(id)}>{label}</button>
          ))}
          <button onClick={onNavigateTeams}>Elencos</button>
        </div>
      </div>
    </div>
  );
}

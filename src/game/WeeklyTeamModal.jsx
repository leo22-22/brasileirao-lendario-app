// Seleção da Rodada — modal (mesmo campo e faixa do craque do card da home,
// via components/football/SelectionPitch). Só leitura: o bônus de OVR já foi
// aplicado nos jogadores de TEAMS no carregamento (App.jsx), e só vale para a
// rodada mais recente de WEEKLY_TEAMS.
import { useMemo, useState } from 'react';
import { TEAMS } from '../data/teams.js';
import { CLUB_LOGOS } from '../data/club-logos.js';
import { displayName } from '../lib/displayName.js';
import { Modal, Icon } from '../ui/index.jsx';
import { SelectionPitch, CraqueStrip, fmtRating } from '../components/football/SelectionPitch.jsx';
import './weeklyTeamModal.css';

const SECTORS = [
  { id: 'gk', label: 'Goleiro', lines: [0] },
  { id: 'df', label: 'Defesa', lines: [1] },
  { id: 'md', label: 'Meio', lines: [2, 3] },
  { id: 'at', label: 'Ataque', lines: [4, 5] },
];

/** weeks: WEEKLY_TEAMS. roleInfo: WEEK_ROLE_INFO. lineTopPct: WEEK_LINE_TOP_PCT. onBuildTeam: abre o fluxo normal de jogo (opcional). */
export function WeeklyTeamModal({ weeks, roleInfo, lineTopPct, onClose, onBuildTeam }) {
  const [idx, setIdx] = useState(weeks.length - 1);
  const w = weeks[idx];
  const isCurrent = idx === weeks.length - 1;

  const players = useMemo(() => w.players.map(wp => {
    const team = TEAMS.find(t => t.id === wp.teamId);
    const player = team?.players.find(p => p.name === wp.name);
    const info = roleInfo[wp.posLabel] || { line: 3, abbr: (wp.posLabel || '').slice(0, 3).toUpperCase() };
    return { ...wp, team, player, ...info, key: `${wp.teamId}|${wp.name}`, current: isCurrent };
  }), [w, roleInfo, isCurrent]);
  const craque = players.find(p => p.craque) || null;
  const year = players.find(p => p.team?.year)?.team.year ?? '';
  const bonus = players.find(p => !p.craque && p.player?.weeklyBoost)?.player.weeklyBoost ?? null;
  const craqueBonus = craque?.player?.weeklyBoost ?? null;

  const ovrText = (p) => {
    if (!p.player) return null;
    if (isCurrent && p.player.weeklyBoost) return `${p.player.ovr - p.player.weeklyBoost} → ${p.player.ovr} OVR`;
    return `${p.player.ovr} OVR`;
  };

  return (
    <Modal onClose={onClose} maxWidth={760} labelledBy="wtm-title" className="wtm-modal">
      <div className="wtm-h">
        <span className="wtm-ring" aria-hidden="true" />
        <div className="wtm-k">Brasileirão {year} real · notas Sofascore</div>
        <h2 id="wtm-title" className="wtm-t">Seleção da {w.label}</h2>
        <div className="wtm-row">
          <div className="wtm-nav" role="group" aria-label="Rodadas">
            <button type="button" onClick={() => setIdx(i => i - 1)} disabled={idx === 0} aria-label="Rodada anterior"><Icon name="chevronLeft" size={16} /></button>
            <span>{isCurrent ? 'Rodada atual' : `Rodada ${w.round}`}</span>
            <button type="button" onClick={() => setIdx(i => i + 1)} disabled={isCurrent} aria-label="Próxima rodada"><Icon name="chevronRight" size={16} /></button>
          </div>
          {isCurrent
            ? (bonus != null && <span className="wtm-pill">+{bonus} OVR no draft{craqueBonus ? ` · craque +${craqueBonus}` : ''}</span>)
            : <span className="wtm-pill wtm-off">Bônus encerrado</span>}
        </div>
        {!isCurrent && <p className="wtm-note">Rodada anterior — o bônus de OVR já não vale mais, só a mais recente vale.</p>}
      </div>

      <div className="wtm-body">
        <div className="wtm-lf">
          <CraqueStrip craque={craque} />
          <SelectionPitch players={players} lineTopPct={lineTopPct} className="wtm-pitch" ariaLabel={`Campo com os 11 da Seleção da ${w.label}`} />
        </div>
        <div className="wtm-rt">
          {SECTORS.map(sec => {
            const list = players.filter(p => sec.lines.includes(p.line));
            if (!list.length) return null;
            return (
              <section key={sec.id} className="wtm-sec" aria-label={sec.label}>
                <h3>{sec.label}</h3>
                {list.map(p => (
                  <div key={p.key} className={`wtm-pl${p.craque ? ' wtm-cq' : ''}`}>
                    <span className="wtm-crest">{p.team && CLUB_LOGOS[p.team.club] ? <img src={CLUB_LOGOS[p.team.club]} alt="" /> : p.abbr}</span>
                    <div className="wtm-nm">
                      <b>{displayName(p.name)}{p.craque && <span className="wtm-tag">craque</span>}</b>
                      <small>{[p.posLabel, p.team ? displayName(p.team.club) : null].filter(Boolean).join(' · ')}</small>
                    </div>
                    {ovrText(p) && <span className="wtm-ovr">{ovrText(p)}</span>}
                    {p.rating != null && <span className="wtm-r">{fmtRating(p.rating)}</span>}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>

      <div className="wtm-foot">
        <span>Notas da rodada real do Brasileirão {year} · fonte: Sofascore</span>
        {onBuildTeam
          ? <button type="button" className="wtm-btn pri" onClick={onBuildTeam}>Montar time com esses cards<Icon name="chevronRight" size={16} /></button>
          : <button type="button" className="wtm-btn" onClick={onClose}>Fechar</button>}
      </div>
    </Modal>
  );
}

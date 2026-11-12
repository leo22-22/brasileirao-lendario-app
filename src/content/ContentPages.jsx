// Páginas de conteúdo (institucionais + índice/detalhe de time histórico) —
// extraídas de App.jsx pra ficarem num bundle PRÓPRIO, separado do jogo (ver
// src/main.jsx e src/content/ContentApp.jsx). Um visitante caindo direto
// numa dessas rotas via busca não baixa o código do draft/simulador/
// multiplayer; só quem entra pra jogar de fato paga esse custo.
//
// O mesmo componente é reaproveitado por dentro do jogo (App.jsx) pra
// navegação client-side sem reload (ex.: clicar em "Times Históricos" no
// rodapé da home enquanto uma partida está rolando) — únicos estilos/dados
// vêm daqui pros dois lados não divergirem com o tempo.
import { useState, useMemo } from 'react';
import { TEAMS } from '../data/teams.js';
import { CLUB_LOGOS } from '../data/club-logos.js';
import { CONTACT_EMAIL, INFO_TABS, HOW_TO_PLAY_STEPS, CLUB_STADIUMS } from '../data/info-content.js';
import { hexToRgba, ovrColor, posOrderIndex, parseTeamLabel } from '../lib/format.js';
import { teamInk } from '../lib/color.js';

const inputStyle = { width: '100%', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const primaryBtnStyle = { background: 'var(--gold)', color: 'var(--ink)', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 700 };

// Link de email reutilizável — clicar SEMPRE copia o endereço pro clipboard
// (com confirmação visível trocando o texto por um instante), além de tentar
// abrir o cliente de email padrão via mailto:. O mailto: sozinho só funciona
// se o dispositivo tiver um app de email configurado como padrão.
export function EmailLink({ subject, style, label }) {
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  const handleClick = () => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(CONTACT_EMAIL)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => { });
  };
  return (
    <a href={mailto} onClick={handleClick} style={style}>
      {copied ? '✅ Email copiado!' : label}
    </a>
  );
}

// Como Jogar, Termos de Uso, Política de Privacidade e Contato — página cheia
// com URL própria, não um modal solto: dá pra compartilhar/favoritar o link
// e o Google indexa cada uma separadamente. Termos/Privacidade NÃO são
// aconselhamento jurídico; vale revisão antes de tratar como documento
// definitivo (LGPD).
export function InfoPage({ tab, onNavigate, onClose, myTeamColor }) {
  const mc = teamInk(myTeamColor || '#C29A45');
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 10000, overflowY: 'auto', padding: '70px 16px 40px' }}>
      <button
        onClick={onClose}
        title="Voltar pro app"
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--surface)', border: `1px solid ${hexToRgba(mc, 0.4)}`,
          borderRadius: 999, padding: '8px 14px', color: mc,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ← Voltar pro app
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {INFO_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id)}
              style={{
                padding: '6px 12px', borderRadius: 999, border: `1px solid ${tab === t.id ? 'var(--gold)' : 'var(--line-strong)'}`,
                background: tab === t.id ? 'rgba(194,154,69,0.12)' : 'transparent',
                color: tab === t.id ? 'var(--gold-ink)' : 'var(--ink-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'como-jogar' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 14 }}>Como Jogar</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              {HOW_TO_PLAY_STEPS.map(step => (
                <div key={step.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{step.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 2, opacity: 1 }}>{step.title}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.6 }}>{step.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'termos' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 12 }}>Termos de Uso</h2>
            <p><b>Sobre o jogo.</b> Brasileirão Lendário é um simulador de futebol gratuito, feito por fã, sem qualquer vínculo oficial com a CBF, clubes ou federações — os nomes de times e jogadores históricos aparecem em caráter editorial/homenagem, sem fins comerciais associados a essas marcas.</p>
            <p><b>Sem apostas ou dinheiro real.</b> Não há qualquer forma de aposta, prêmio em dinheiro ou compra dentro do jogo. É puramente entretenimento.</p>
            <p><b>Sua conta.</b> Você é responsável por manter sua senha em segurança. Pode excluir sua conta e todos os dados associados a qualquer momento, direto no painel de conta.</p>
            <p><b>Modo multiplayer.</b> Ao jogar com outras pessoas, espera-se conduta respeitosa. Não há moderação em tempo real do chat — use o bom senso.</p>
            <p><b>Sem garantias.</b> O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta nem ausência total de erros.</p>
            <p><b>Mudanças.</b> Estes termos podem ser atualizados conforme o jogo evolui.</p>
            <p style={{ opacity: 0.5, fontSize: 11.5 }}>Dúvidas: <EmailLink label={CONTACT_EMAIL} style={{ color: 'var(--gold-ink)', textDecoration: 'underline' }} /></p>
          </div>
        )}

        {tab === 'privacidade' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 12 }}>Política de Privacidade</h2>
            <p><b>O que coletamos.</b> Nome de usuário, email e senha (guardada só como hash, nunca em texto puro) ao criar conta; estatísticas de jogo (temporadas, gols, títulos etc.) associadas à sua conta; e o endereço IP das suas requisições, usado só pra limitar tentativas de login e evitar abuso — não pra rastreamento.</p>
            <p><b>Armazenamento local.</b> O progresso da partida em andamento e o token de login ficam salvos no seu próprio navegador (localStorage), não em nossos servidores.</p>
            <p><b>Google Analytics.</b> Usamos o Google Analytics pra entender, de forma agregada, como o site é usado (páginas vistas, eventos como criar conta ou completar uma temporada). Não vendemos nem compartilhamos seus dados pessoais com terceiros pra fins de publicidade.</p>
            <p><b>Seus direitos.</b> Você pode acessar, corrigir ou excluir seus dados a qualquer momento — a exclusão de conta (disponível no painel) apaga permanentemente seu registro do nosso banco de dados.</p>
            <p><b>Menores de idade.</b> O jogo não é direcionado especificamente a crianças menores de 13 anos.</p>
            <p style={{ opacity: 0.5, fontSize: 11.5 }}>Dúvidas ou solicitações sobre seus dados: <EmailLink label={CONTACT_EMAIL} style={{ color: 'var(--gold-ink)', textDecoration: 'underline' }} /></p>
          </div>
        )}

        {tab === 'contato' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 12 }}>Fala com a gente!</h2>
            <p>Esse jogo é feito por (e pra) quem ama futebol brasileiro — então toda ideia é bem-vinda:</p>
            <p><b>🏟️ Quer que a gente adicione algum time histórico que falta?</b> Manda os 20 atletas completos (titulares + reservas) do elenco que você quer ver no jogo, com posição de cada um — a gente confere e, se entrar, divulga aqui no site quem teve a ideia.</p>
            <p><b>💡 Tem alguma sugestão, bug pra reportar ou só quer trocar uma ideia?</b> Manda pra gente também — toda sugestão que vira novidade no jogo, o crédito é seu.</p>
            <p style={{ marginTop: 16 }}>
              <EmailLink label={`✉️ ${CONTACT_EMAIL}`} style={{ color: 'var(--gold-ink)', fontWeight: 700, textDecoration: 'none', fontSize: 14 }} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Ordens de exibição do índice de elencos — padrão alfabético crescente
// (pedido explícito do usuário 2026-11-11: "deixe tudo por ordem
// alfabetica"), com botões pra trocar pra Z-A ou por ano. Ordena pelo
// nome BASE do clube (sem o ano/conquista no fim, via parseTeamLabel) —
// senão "Flamengo 1981" e "Flamengo 1992" não ficariam vizinhos.
const SORT_MODES = [
  { id: 'az', label: 'A-Z' },
  { id: 'za', label: 'Z-A' },
  { id: 'ano', label: 'Ano' },
];
function sortTeams(teams, mode) {
  const withBaseName = teams.map(t => ({ t, base: parseTeamLabel(t.label).baseName }));
  if (mode === 'za') withBaseName.sort((a, b) => b.base.localeCompare(a.base) || b.t.year - a.t.year);
  else if (mode === 'ano') withBaseName.sort((a, b) => a.t.year - b.t.year || a.base.localeCompare(b.base));
  else withBaseName.sort((a, b) => a.base.localeCompare(b.base) || a.t.year - b.t.year);
  return withBaseName.map(x => x.t);
}

// Índice + detalhe dos elencos (ex-"Times Históricos") — conteúdo
// indexável de verdade (URL própria por time), gerado só a partir do que
// já existe em TEAMS (clube, ano, técnico, conquista, elenco real) —
// nenhum fato novo é inventado. Mesmo visual/estrutura do InfoPage
// (overlay + botão "Voltar pro app" fixo), pra manter consistência.
export function TeamsIndexPage({ onBack, onOpenTeam, myTeamColor }) {
  const mc = teamInk(myTeamColor || '#C29A45');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('az');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? TEAMS.filter(t => t.label.toLowerCase().includes(q) || String(t.year).includes(q)) : TEAMS;
    return sortTeams(base, sortMode);
  }, [query, sortMode]);
  return (
    <div onClick={onBack} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 10000, overflowY: 'auto', padding: '70px 16px 40px' }}>
      <button
        onClick={onBack}
        title="Voltar pro app"
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--surface)', border: `1px solid ${hexToRgba(mc, 0.4)}`,
          borderRadius: 999, padding: '8px 14px', color: mc,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ← Voltar pro app
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, position: 'relative' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Elencos</h1>
        <p style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.6, marginBottom: 14 }}>
          Os {TEAMS.length} times que você pode sortear no draft do Brasileirão Lendário, cada um com o elenco real da época.
        </p>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar time por nome ou ano..."
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {SORT_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setSortMode(m.id)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1px solid ${sortMode === m.id ? mc : 'var(--line-strong)'}`,
                background: sortMode === m.id ? hexToRgba(mc, 0.15) : 'var(--surface)',
                color: sortMode === m.id ? mc : 'var(--ink-2)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center', padding: 16 }}>Nenhum time encontrado.</div>
          )}
          {filtered.map(team => {
            const { baseName, achievement } = parseTeamLabel(team.label);
            return (
              <button
                key={team.id}
                onClick={() => onOpenTeam(team.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--line)', background: 'var(--surface)',
                  color: 'var(--ink)', textAlign: 'left', cursor: 'pointer',
                }}
              >
                {CLUB_LOGOS[team.club]
                  ? <img src={CLUB_LOGOS[team.club]} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0, background: 'var(--surface)', borderRadius: 5 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                  : <span style={{ width: 14, height: 14, borderRadius: '50%', background: team.colors?.p || mc, border: '1px solid var(--line-strong)', flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{baseName} <span style={{ opacity: 0.5, fontWeight: 400 }}>{team.year}</span></div>
                  {achievement && <div style={{ fontSize: 11, color: mc, marginTop: 1 }}>{achievement}</div>}
                </div>
                <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }}>{team.players.length} jogadores</span>
                <span style={{ fontSize: 14, opacity: 0.4, flexShrink: 0 }}>→</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TeamDetailPage({ team, onBack, onOpenIndex, myTeamColor, onPlayWithTeam }) {
  const mc = teamInk(myTeamColor || '#C29A45');
  if (!team) return null;
  const { baseName, achievement } = parseTeamLabel(team.label);
  const starters = [...team.players.slice(0, 11)].sort((a, b) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]));
  const bench = team.players.slice(11);
  return (
    <div onClick={onBack} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 10000, overflowY: 'auto', padding: '70px 16px 40px' }}>
      <button
        onClick={onBack}
        title="Voltar pro app"
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--surface)', border: `1px solid ${hexToRgba(mc, 0.4)}`,
          borderRadius: 999, padding: '8px 14px', color: mc,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ← Voltar pro app
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 24, position: 'relative' }}>
        <button onClick={onOpenIndex} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
          ← Ver todos os elencos
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {CLUB_LOGOS[team.club]
            ? <img src={CLUB_LOGOS[team.club]} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0, background: 'var(--surface)', borderRadius: 6 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            : <span style={{ width: 14, height: 14, borderRadius: '50%', background: team.colors?.p || mc, border: '1px solid var(--line-strong)', flexShrink: 0 }} />
          }
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700 }}>{baseName} <span style={{ opacity: 0.5, fontWeight: 400 }}>{team.year}</span></h1>
        </div>
        {achievement && (
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: mc, background: hexToRgba(mc, 0.12), border: `1px solid ${hexToRgba(mc, 0.35)}`, borderRadius: 999, padding: '3px 10px', marginBottom: 12 }}>
            🏆 {achievement}
          </div>
        )}
        {CLUB_STADIUMS[team.club] && (
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
            🏟️ {CLUB_STADIUMS[team.club]}
          </div>
        )}
        <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6, marginBottom: 14 }}>
          Monte o {baseName}{achievement ? ` (${achievement})` : ''} no Brasileirão Lendário: elenco completo com {team.players.length} jogadores reais, técnico {team.coach}, e dispute o Brasileirão ou a Copa do Brasil sozinho ou com amigos.
        </p>

        {onPlayWithTeam && (
          <button
            onClick={() => onPlayWithTeam(team)}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: mc, color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 18,
            }}
          >
            ▶ Jogar com este time
          </button>
        )}

        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 6 }}>Titulares</div>
        {starters.map((p, i) => (
          <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
            <span style={{ width: 36, fontSize: 10, color: 'var(--muted)' }}>{p.pos?.[0] || '-'}</span>
            <span style={{ flex: 1 }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: ovrColor(p.ovr), fontSize: 11 }} title="Força no simulador, não é uma estatística histórica oficial">{p.ovr}</span>
          </div>
        ))}
        {bench.length > 0 && (
          <>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginTop: 14, marginBottom: 6 }}>Banco</div>
            {bench.map((p, i) => (
              <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                <span style={{ width: 36, fontSize: 10, color: 'var(--muted)' }}>{p.pos?.[0] || '-'}</span>
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: ovrColor(p.ovr), fontSize: 11 }} title="Força no simulador, não é uma estatística histórica oficial">{p.ovr}</span>
              </div>
            ))}
          </>
        )}
        <div style={{ fontSize: 10, opacity: 0.4, marginTop: 10 }}>* Overall é a força do jogador no simulador, não uma estatística histórica oficial.</div>

        <button onClick={onBack} style={{ ...primaryBtnStyle, width: '100%', marginTop: 20, background: mc, color: '#fff' }}>
          Jogar agora →
        </button>
      </div>
    </div>
  );
}

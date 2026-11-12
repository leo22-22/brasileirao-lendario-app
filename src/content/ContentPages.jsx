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
import { ERA_BUCKETS } from '../lib/eras.js';
import { Icon, BrandMark, SiteFooter, Tabs, Input, Button, Tag, TeamBadge } from '../ui/index.jsx';
import '../home/home.css';
import { displayName } from '../lib/displayName.js';


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

// Casca comum das páginas de conteúdo: mesmo cabeçalho e rodapé da home.
// Continua sendo uma camada fixa por cima do jogo (quando aberta de dentro
// do App), mas agora com cara de página do site, não de modal.
function ContentShell({ onHome, onNavigateInfo, onNavigateTeams, maxWidth = 760, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 10000, overflowY: 'auto', color: 'var(--ink)' }}>
      <header className="ui-header">
        <div className="ui-header-inner">
          <button type="button" className="ui-brand" onClick={onHome} title="Voltar ao início">
            <BrandMark />
            <span style={{ minWidth: 0 }}>
              <span className="ui-brand-name">Brasileirão Lendário</span>
              <span className="ui-brand-sub">monte · escale · seja campeão</span>
            </span>
          </button>
          <div className="ui-header-actions">
            {onNavigateTeams && (
              <button type="button" className="ui-hbtn ui-hide-mobile" onClick={onNavigateTeams}>
                <Icon name="shirt" size={16} /> Elencos
              </button>
            )}
            {onNavigateInfo && (
              <button type="button" className="ui-hbtn ui-hide-mobile" onClick={() => onNavigateInfo('como-jogar')}>
                <Icon name="info" size={16} /> Como jogar
              </button>
            )}
            <button type="button" className="ui-hbtn ui-hbtn-dark" onClick={onHome}>
              <Icon name="play" size={13} /> Jogar agora
            </button>
          </div>
        </div>
      </header>
      <main style={{ maxWidth, margin: '0 auto', padding: '32px 16px 56px' }}>
        {children}
      </main>
      {onNavigateInfo && onNavigateTeams && (
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <SiteFooter onNavigateInfo={onNavigateInfo} onNavigateTeams={onNavigateTeams} />
        </div>
      )}
    </div>
  );
}

const INFO_ICON = { 'como-jogar': 'info', termos: 'list', privacidade: 'lock', contato: 'chat' };
const proseStyle = { fontSize: 15, lineHeight: 1.75, color: 'var(--ink-2)' };
const h2Style = { fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 18px', color: 'var(--ink)' };

// Como Jogar, Termos de Uso, Política de Privacidade e Contato — página cheia
// com URL própria, não um modal solto: dá pra compartilhar/favoritar o link
// e o Google indexa cada uma separadamente. Termos/Privacidade NÃO são
// aconselhamento jurídico; vale revisão antes de tratar como documento
// definitivo (LGPD).
export function InfoPage({ tab, onNavigate, onClose, onNavigateTeams }) {
  return (
    <ContentShell onHome={onClose} onNavigateInfo={onNavigate} onNavigateTeams={onNavigateTeams}>
      <Tabs
        tabs={INFO_TABS.map(t => ({ id: t.id, label: t.label, icon: INFO_ICON[t.id] }))}
        value={tab}
        onChange={onNavigate}
        style={{ marginBottom: 28 }}
      />
      <article style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 'clamp(20px, 4vw, 36px)' }}>
        {tab === 'como-jogar' && (
          <div style={proseStyle}>
            <span className="ui-eyebrow"><i />Guia rápido</span>
            <h2 style={{ ...h2Style, marginTop: 10 }}>Como <em style={{ color: 'var(--gold-ink)' }}>jogar</em></h2>
            <ol style={{ display: 'grid', gap: 18, listStyle: 'none', padding: 0, margin: 0 }}>
              {HOW_TO_PLAY_STEPS.map((step, i) => (
                <li key={step.title} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 14, alignItems: 'start' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 30, color: 'var(--gold-ink)', lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>{step.title}</div>
                    <div style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>{step.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {tab === 'termos' && (
          <div style={proseStyle}>
            <h2 style={h2Style}>Termos de Uso</h2>
            <p><b>Sobre o jogo.</b> Brasileirão Lendário é um simulador de futebol gratuito, feito por fã, sem qualquer vínculo oficial com a CBF, clubes ou federações — os nomes de times e jogadores históricos aparecem em caráter editorial/homenagem, sem fins comerciais associados a essas marcas.</p>
            <p><b>Sem apostas ou dinheiro real.</b> Não há qualquer forma de aposta, prêmio em dinheiro ou compra dentro do jogo. É puramente entretenimento.</p>
            <p><b>Sua conta.</b> Você é responsável por manter sua senha em segurança. Pode excluir sua conta e todos os dados associados a qualquer momento, direto no painel de conta.</p>
            <p><b>Modo multiplayer.</b> Ao jogar com outras pessoas, espera-se conduta respeitosa. Não há moderação em tempo real do chat — use o bom senso.</p>
            <p><b>Sem garantias.</b> O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta nem ausência total de erros.</p>
            <p><b>Mudanças.</b> Estes termos podem ser atualizados conforme o jogo evolui.</p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Dúvidas: <EmailLink label={CONTACT_EMAIL} style={{ color: 'var(--gold-ink)', textDecoration: 'underline' }} /></p>
          </div>
        )}

        {tab === 'privacidade' && (
          <div style={proseStyle}>
            <h2 style={h2Style}>Política de Privacidade</h2>
            <p><b>O que coletamos.</b> Nome de usuário, email e senha (guardada só como hash, nunca em texto puro) ao criar conta; estatísticas de jogo (temporadas, gols, títulos etc.) associadas à sua conta; e o endereço IP das suas requisições, usado só pra limitar tentativas de login e evitar abuso — não pra rastreamento.</p>
            <p><b>Armazenamento local.</b> O progresso da partida em andamento e o token de login ficam salvos no seu próprio navegador (localStorage), não em nossos servidores.</p>
            <p><b>Google Analytics.</b> Usamos o Google Analytics pra entender, de forma agregada, como o site é usado (páginas vistas, eventos como criar conta ou completar uma temporada). Não vendemos nem compartilhamos seus dados pessoais com terceiros pra fins de publicidade.</p>
            <p><b>Seus direitos.</b> Você pode acessar, corrigir ou excluir seus dados a qualquer momento — a exclusão de conta (disponível no painel) apaga permanentemente seu registro do nosso banco de dados.</p>
            <p><b>Menores de idade.</b> O jogo não é direcionado especificamente a crianças menores de 13 anos.</p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Dúvidas ou solicitações sobre seus dados: <EmailLink label={CONTACT_EMAIL} style={{ color: 'var(--gold-ink)', textDecoration: 'underline' }} /></p>
          </div>
        )}

        {tab === 'contato' && (
          <div style={proseStyle}>
            <h2 style={h2Style}>Fala com a <em style={{ color: 'var(--gold-ink)' }}>gente</em></h2>
            <p>Esse jogo é feito por (e pra) quem ama futebol brasileiro — então toda ideia é bem-vinda:</p>
            <p><b>Quer que a gente adicione algum time histórico que falta?</b> Manda os 20 atletas completos (titulares + reservas) do elenco que você quer ver no jogo, com posição de cada um — a gente confere e, se entrar, divulga aqui no site quem teve a ideia.</p>
            <p><b>Tem alguma sugestão, bug pra reportar ou só quer trocar uma ideia?</b> Manda pra gente também — toda sugestão que vira novidade no jogo, o crédito é seu.</p>
            <p style={{ marginTop: 20 }}>
              <EmailLink label={CONTACT_EMAIL} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, padding: '0 22px', borderRadius: 999, background: 'var(--green)', color: '#fff', fontWeight: 500, textDecoration: 'none', fontSize: 15 }} />
            </p>
          </div>
        )}
      </article>
    </ContentShell>
  );
}

// Ordens de exibição do índice de elencos — padrão alfabético crescente
// (pedido explícito do usuário 2026-11-11: "deixe tudo por ordem
// alfabetica"), com botões pra trocar pra Z-A ou por ano. Ordena pelo
// nome BASE do clube (sem o ano/conquista no fim, via parseTeamLabel) —
// senão "Flamengo 1981" e "Flamengo 1992" não ficariam vizinhos.
const SORT_MODES = [
  { id: 'az', label: 'A–Z' },
  { id: 'za', label: 'Z–A' },
  { id: 'ano', label: 'Ano' },
];
function sortTeams(teams, mode) {
  const withBaseName = teams.map(t => ({ t, base: parseTeamLabel(t.label).baseName }));
  if (mode === 'za') withBaseName.sort((a, b) => b.base.localeCompare(a.base) || b.t.year - a.t.year);
  else if (mode === 'ano') withBaseName.sort((a, b) => a.t.year - b.t.year || a.base.localeCompare(b.base));
  else withBaseName.sort((a, b) => a.base.localeCompare(b.base) || a.t.year - b.t.year);
  return withBaseName.map(x => x.t);
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Índice + detalhe dos elencos (ex-"Times Históricos") — conteúdo
// indexável de verdade (URL própria por time), gerado só a partir do que
// já existe em TEAMS (clube, ano, técnico, conquista, elenco real) —
// nenhum fato novo é inventado. Cards iguais aos do acervo da home.
export function TeamsIndexPage({ onBack, onOpenTeam, onNavigateInfo, onNavigateTeams }) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('az');
  const [era, setEra] = useState('all');
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const bucket = ERA_BUCKETS.find(e => e.key === era) || ERA_BUCKETS[0];
    const base = TEAMS.filter(t => bucket.test(t.year) && (!q || normalize(t.label).includes(q) || String(t.year).includes(q)));
    return sortTeams(base, sortMode);
  }, [query, sortMode, era]);
  return (
    <ContentShell onHome={onBack} onNavigateInfo={onNavigateInfo} onNavigateTeams={onNavigateTeams} maxWidth={1240}>
      <div className="hl-home">
        <div className="ui-sh">
          <div>
            <span className="ui-eyebrow"><i />O acervo</span>
            <h1 className="ui-title ui-title-lg">{TEAMS.length} elencos que marcaram <em>época</em>.</h1>
            <p>Os times que você pode sortear no draft do Brasileirão Lendário, cada um com o elenco real da época.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <Input icon="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar time por nome ou ano…" aria-label="Buscar time" style={{ flex: '1 1 260px' }} />
          <Tabs tabs={SORT_MODES} value={sortMode} onChange={setSortMode} style={{ flex: '0 0 auto' }} />
        </div>
        <div className="hl-eras">
          {ERA_BUCKETS.map(e => (
            <button key={e.key} className={`hl-era${era === e.key ? ' hl-on' : ''}`} onClick={() => setEra(e.key)} style={{ minHeight: 40 }}>{e.label}</button>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>{filtered.length} {filtered.length === 1 ? 'elenco' : 'elencos'}</p>
        {filtered.length === 0 ? (
          <div className="hl-empty-note">Nenhum time encontrado.</div>
        ) : (
          <div className="hl-teams">
            {filtered.map(t => {
              const { baseName, achievement } = parseTeamLabel(t.label);
              const p = t.colors?.p || '#1a1a1a';
              const s2 = t.colors?.s || '#2b2b2b';
              return (
                <button key={t.id} type="button" className="hl-team hl-card-hover" onClick={() => onOpenTeam(t.id)} style={{ textAlign: 'left', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', color: 'var(--ink)' }}>
                  <div className="hl-band" style={{ background: `linear-gradient(0deg, rgba(0,0,0,0.38), rgba(0,0,0,0) 65%), linear-gradient(135deg, ${p} 0 55%, ${s2} 55%)` }}>
                    {CLUB_LOGOS[t.club] && <img src={CLUB_LOGOS[t.club]} alt="" className="hl-crest" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    <span className="hl-yr">{t.year}</span>
                  </div>
                  <div className="hl-body">
                    <h4>{baseName}</h4>
                    <p>{achievement || `${t.players.length} jogadores`}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </ContentShell>
  );
}

export function TeamDetailPage({ team, onBack, onOpenIndex, onPlayWithTeam, onNavigateInfo }) {
  if (!team) return null;
  const { baseName, achievement } = parseTeamLabel(team.label);
  const starters = [...team.players.slice(0, 11)].sort((a, b) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]));
  const bench = team.players.slice(11);
  const p = team.colors?.p || '#1a1a1a';
  const s2 = team.colors?.s || '#2b2b2b';
  const row = (pl, i) => (
    <div key={`${pl.name}-${i}`} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14.5 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{pl.pos?.[0] || '-'}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: ovrColor(pl.ovr), fontSize: 13 }} title="Força no simulador, não é uma estatística histórica oficial">{pl.ovr}</span>
    </div>
  );
  return (
    <ContentShell onHome={onBack} onNavigateInfo={onNavigateInfo} onNavigateTeams={onOpenIndex}>
      <button type="button" onClick={onOpenIndex} className="ui-btn ui-btn-ghost ui-btn-sm" style={{ marginBottom: 20 }}>
        <Icon name="arrowLeft" size={15} /> Todos os elencos
      </button>
      <div style={{ borderRadius: 22, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ padding: '28px 24px 22px', background: `linear-gradient(0deg, rgba(0,0,0,0.45), rgba(0,0,0,0.05)), linear-gradient(135deg, ${p} 0 55%, ${s2} 55%)`, color: '#fff', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <TeamBadge src={CLUB_LOGOS[team.club]} name={displayName(team.club)} color={p} size={56} radius={14} style={{ background: 'rgba(255,255,255,0.92)', padding: 6 }} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 34, letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0, textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>{baseName}</h1>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', marginTop: 6, opacity: 0.9 }}>{team.year}{team.coach ? ` · técnico ${team.coach}` : ''}</div>
          </div>
        </div>
        <div style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {achievement && <Tag tone="gold" icon="trophy">{achievement}</Tag>}
            {CLUB_STADIUMS[team.club] && <Tag>{CLUB_STADIUMS[team.club]}</Tag>}
            <Tag>{team.players.length} jogadores</Tag>
          </div>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65, margin: '0 0 18px' }}>
            Monte o {baseName}{achievement ? ` (${achievement})` : ''} no Brasileirão Lendário: elenco completo com {team.players.length} jogadores reais, técnico {team.coach}, e dispute o Brasileirão ou a Copa do Brasil sozinho ou com amigos.
          </p>
          {onPlayWithTeam && (
            <Button variant="dark" size="lg" icon="play" onClick={() => onPlayWithTeam(team)} style={{ marginBottom: 24 }}>Jogar com este time</Button>
          )}
          <div className="ui-label" style={{ marginBottom: 4 }}>Titulares</div>
          {starters.map(row)}
          {bench.length > 0 && (
            <>
              <div className="ui-label" style={{ marginTop: 20, marginBottom: 4 }}>Banco</div>
              {bench.map(row)}
            </>
          )}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>* Overall é a força do jogador no simulador, não uma estatística histórica oficial.</div>
          {!onPlayWithTeam && (
            <Button variant="dark" size="lg" block iconRight="arrowRight" onClick={onBack} style={{ marginTop: 22 }}>Jogar agora</Button>
          )}
        </div>
      </div>
    </ContentShell>
  );
}

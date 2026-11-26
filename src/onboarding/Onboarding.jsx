// Primeiro acesso e criação de conta (2026-11-26, pedido do usuário).
//
// FirstVisitWelcome — quem nunca jogou caía direto em "Escolha o esquema
// tático" (22 esquemas, sem saber o que é o jogo). Agora vê o jogo em 3
// passos e um botão que já começa o draft com um esquema padrão.
//
// ClubSignupModal — ao terminar um jogo sem conta, a criação da conta é
// obrigatória: primeiro o clube (nome, cor, escudo), depois a conta. Sem
// botão de fechar. Única saída sem conta: se o SERVIDOR falhar (fora do ar),
// pra ninguém ficar preso numa tela por um problema nosso.
import { useMemo, useState } from 'react';
import * as api from '../api.js';
import { CLUB_LOGOS } from '../data/club-logos.js';
import { Icon, Layer } from '../ui/index.jsx';
import './onboarding.css';

export const ONBOARDING_COLORS = ['#C29A45', '#e05050', '#4a90d9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#e91e8c', '#111111'];

const STEPS = [
  { n: 1, title: 'Escolha o esquema', text: '4-3-3, 4-4-2, três zagueiros… ou monte a sua formação.' },
  { n: 2, title: 'Sorteie os campeões', text: 'Cada rodada sorteia um time histórico. Você pega um jogador de cada.' },
  { n: 3, title: 'Dispute o campeonato', text: 'Brasileirão ou Copa do Brasil, com cronômetro ao vivo e ranking.' },
];

export function FirstVisitWelcome({ onQuickStart, onPickFormation, onSeeModes, onLogin, stats }) {
  return (
    <div className="ob-welcome">
      <span className="ob-eyebrow">Bem-vindo ao Brasileirão Lendário</span>
      <h1 className="ob-title">Monte o time <em>lendário</em> dos seus sonhos</h1>
      <p className="ob-lead">Pelé, Zico, Romário e os maiores campeões do Brasil no mesmo elenco. Leva menos de 5 minutos pra montar o seu.</p>
      <ol className="ob-steps">
        {STEPS.map(s => (
          <li key={s.n}>
            <span className="ob-n">{s.n}</span>
            <div><b>{s.title}</b><span>{s.text}</span></div>
          </li>
        ))}
      </ol>
      <div className="ob-ctas">
        <button type="button" className="ui-btn ui-btn-dark ui-btn-lg ob-main" onClick={onQuickStart}>
          Jogar agora <Icon name="chevronRight" size={18} />
        </button>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-lg" onClick={onPickFormation}>Escolher o esquema</button>
      </div>
      <p className="ob-note">"Jogar agora" começa o draft num 4-3-3. Dá pra trocar o esquema depois.</p>
      {stats && <p className="ob-stats">{stats}</p>}
      <div className="ob-links">
        <button type="button" onClick={onSeeModes}>Ver todos os modos de jogo</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onLogin}>Já tenho conta</button>
      </div>
    </div>
  );
}

const isServerFailure = (err) => !err?.status || err.status >= 500;

export function ClubSignupModal({ initialName, initialColor, initialLogo, headline, onDone, onSkip }) {
  const [step, setStep] = useState('club'); // 'club' | 'signup' | 'login'
  const [name, setName] = useState(initialName && initialName !== 'Meu Time' ? initialName : '');
  const [color, setColor] = useState(initialColor || ONBOARDING_COLORS[0]);
  const [logo, setLogo] = useState(initialLogo || null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const logos = useMemo(() => Object.entries(CLUB_LOGOS), []);
  const teamName = name.trim() || 'Meu Time';

  const goAccount = () => {
    if (!name.trim()) { setError('Dê um nome ao seu time.'); return; }
    setError('');
    setStep('signup');
  };

  const submit = async () => {
    setError('');
    if (step === 'signup' && !username.trim()) { setError('Escolha um nome de usuário.'); return; }
    if (!email.trim() || !password) { setError('Preencha email e senha.'); return; }
    if (step === 'signup' && password.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      if (step === 'signup') {
        const result = await api.signup(username.trim(), email.trim(), password);
        api.setToken(result.token);
        // Identidade do clube vai junto pra conta nova.
        const updated = await api.updateMe({ team_name: teamName, team_color: color, team_logo: logo }).catch(() => null);
        onDone({ result: { token: result.token, user: updated?.user || result.user }, mode: 'signup', team: { name: teamName, color, logo } });
      } else {
        // Login: a conta já tem o próprio clube — não sobrescreve.
        const result = await api.login(email.trim(), password);
        onDone({ result, mode: 'login', team: null });
      }
    } catch (err) {
      if (isServerFailure(err)) {
        setServerDown(true);
        setError('Não conseguimos falar com o servidor agora. Tente de novo em instantes.');
      } else {
        setError(err.message || 'Algo deu errado. Tente de novo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layer>
      <div className="ob-overlay">
        <div className="ob-modal" role="dialog" aria-modal="true" aria-labelledby="ob-modal-title">
          <div className="ob-prog" aria-hidden="true"><i className="ob-on" /><i className={step !== 'club' ? 'ob-on' : ''} /></div>
          {headline && <div className="ob-headline">{headline}</div>}

          {step === 'club' && (
            <>
              <h2 id="ob-modal-title">Agora, dê uma cara ao seu clube</h2>
              <p className="ob-sub">É assim que ele aparece na tabela, no ranking e para os amigos.</p>
              <div className="ob-preview" style={{ '--club': color }}>
                <span className="ob-crest">{logo ? <img src={logo} alt="" /> : <Icon name="shield" size={26} />}</span>
                <div><b>{teamName}</b><small>Seu clube</small></div>
              </div>
              <label className="ob-label" htmlFor="ob-name">Nome do time</label>
              <input id="ob-name" className="ob-input" value={name} maxLength={24} placeholder="Ex.: Lendários FC" onChange={e => setName(e.target.value)} autoFocus />
              <div className="ob-label">Cor</div>
              <div className="ob-colors" role="radiogroup" aria-label="Cor do time">
                {ONBOARDING_COLORS.map(c => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Cor ${c}`} className={color === c ? 'ob-on' : ''} style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
              <div className="ob-label">Escudo <span>(opcional)</span></div>
              <div className="ob-logos">
                <button type="button" className={!logo ? 'ob-on' : ''} onClick={() => setLogo(null)} aria-label="Sem escudo"><Icon name="shield" size={18} /></button>
                {logos.map(([club, url]) => (
                  <button key={club} type="button" title={club} aria-label={club} className={logo === url ? 'ob-on' : ''} onClick={() => setLogo(url)}>
                    {/* Escudo que não carrega (link quebrado) some da grade em vez de virar quadrado vazio. */}
                    <img src={url} alt="" loading="lazy" onError={e => { const b = e.currentTarget.closest('button'); if (b) b.style.display = 'none'; }} />
                  </button>
                ))}
              </div>
              {error && <div className="ob-error" role="alert">{error}</div>}
              <button type="button" className="ui-btn ui-btn-dark ui-btn-lg ui-btn-block" onClick={goAccount}>Continuar <Icon name="chevronRight" size={18} /></button>
            </>
          )}

          {(step === 'signup' || step === 'login') && (
            <>
              <button type="button" className="ob-back" onClick={() => { setStep('club'); setError(''); }}>← Voltar ao clube</button>
              <h2 id="ob-modal-title">{step === 'signup' ? 'Crie sua conta para salvar o clube' : 'Entrar na sua conta'}</h2>
              <p className="ob-sub">
                {step === 'signup'
                  ? 'Seu time, seus títulos e este resultado ficam salvos e entram no ranking. Leva 20 segundos.'
                  : 'Seu clube e seu histórico voltam com você. Este resultado entra no ranking.'}
              </p>
              {step === 'signup' && (
                <input className="ob-input" value={username} maxLength={20} placeholder="Nome de usuário" autoComplete="username" onChange={e => setUsername(e.target.value)} autoFocus />
              )}
              <input className="ob-input" type="email" value={email} placeholder="Email" autoComplete="email" onChange={e => setEmail(e.target.value)} autoFocus={step === 'login'} />
              <input className="ob-input" type="password" value={password} placeholder={step === 'signup' ? 'Senha (mín. 6 caracteres)' : 'Senha'} autoComplete={step === 'signup' ? 'new-password' : 'current-password'} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && submit()} />
              {error && <div className="ob-error" role="alert">{error}</div>}
              <button type="button" className="ui-btn ui-btn-dark ui-btn-lg ui-btn-block" disabled={loading} onClick={submit}>
                {loading ? 'Aguarde…' : step === 'signup' ? 'Criar conta e salvar' : 'Entrar'}
              </button>
              <button type="button" className="ob-switch" onClick={() => { setStep(step === 'signup' ? 'login' : 'signup'); setError(''); }}>
                {step === 'signup' ? 'Já tenho conta — entrar' : 'Não tenho conta — criar agora'}
              </button>
              {serverDown && onSkip && (
                <button type="button" className="ob-skip" onClick={onSkip}>Nosso servidor não respondeu. Continuar sem conta por enquanto</button>
              )}
            </>
          )}
        </div>
      </div>
    </Layer>
  );
}

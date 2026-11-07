import { lazy, Suspense, useEffect, useState } from 'react';
import { getForecast } from './services/weatherApi.js';
import { RainBars, TempLine } from './components/Charts.jsx';
import { Indicators, LastDays, MonthPanel, Rain24h, RainEvents, Empty } from './components/Panels.jsx';
import PredictionForm from './components/PredictionForm.jsx';
import HistoricoBusca from './components/HistoricoBusca.jsx';
import PeriodComparison from './components/PeriodComparison.jsx';
import { fmtDateTime, fmtDay, fmtFullDateTime } from './lib/format.js';

// O mapa (Leaflet) carrega à parte, para não pesar o carregamento inicial da página.
const CityMap = lazy(() => import('./components/CityMap.jsx'));

const NAV = [['mapa', 'Mapa'], ['agora', 'Agora'], ['semana', 'Semana'], ['dados', 'Dados'], ['integracao', 'Integração']];

// Duas rotas sem roteador: "/" é o painel (Mapa, Agora, Semana e Dados são seções dele) e "/integracao" é outra tela.
const RAIZ = import.meta.env.BASE_URL;
const ROTA_INTEGRACAO = `${RAIZ}integracao`;
const telaDaUrl = () => (window.location.pathname.replace(/\/+$/, '') === ROTA_INTEGRACAO ? 'integracao' : 'painel');

export default function App() {
  const [menu, setMenu] = useState(false);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tela, setTela] = useState(telaDaUrl);
  const [alvo, setAlvo] = useState(null); // seção para rolar depois da troca de tela

  useEffect(() => {
    const voltar = () => setTela(telaDaUrl()); // botões voltar/avançar do navegador
    window.addEventListener('popstate', voltar);
    return () => window.removeEventListener('popstate', voltar);
  }, []);

  // A seção só existe depois que o painel aparece, por isso a rolagem fica num efeito.
  useEffect(() => {
    if (!alvo) return;
    if (alvo.id === 'integracao') window.scrollTo(0, 0);
    else document.getElementById(alvo.id)?.scrollIntoView();
  }, [alvo]);

  function irPara(e, id) {
    e.preventDefault();
    setMenu(false);
    const destino = id === 'integracao' ? ROTA_INTEGRACAO : RAIZ;
    if (window.location.pathname !== destino) window.history.pushState(null, '', destino);
    setTela(id === 'integracao' ? 'integracao' : 'painel');
    setAlvo({ id });
  }

  useEffect(() => {
    const ctrl = new AbortController();
    getForecast({ signal: ctrl.signal })
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((e) => e.name !== 'AbortError' && setState((s) => ({ ...s, loading: false, error: e.message })));
    return () => ctrl.abort();
  }, []);

  const { data, loading, error } = state;
  const meta = data?.meta;
  const errs = meta?.errors ?? {}; // erro por consulta (allSettled)
  const lastDay = data?.daily?.at(-1)?.date;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <a className="brand" href={RAIZ} onClick={(e) => irPara(e, 'mapa')} aria-label="Chuva Londrina, ir para o início">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round">
              <path d="M7 15a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18 8.5 3.5 3.5 0 0 1 17.5 15z" /><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" />
            </svg>
            <span><b>Chuva Londrina</b><small>Monitoramento de chuva</small></span>
          </a>
          <button className="menu-btn" aria-expanded={menu} aria-controls="nav" onClick={() => setMenu(!menu)}>Menu</button>
          <nav id="nav" className={menu ? 'open' : ''} aria-label="Principal">
            {NAV.map(([id, n]) => <a key={id} href={id === 'integracao' ? ROTA_INTEGRACAO : RAIZ} aria-current={id === tela ? 'page' : undefined} onClick={(e) => irPara(e, id)}>{n}</a>)}
          </nav>
        </div>
      </header>

      {tela === 'integracao' ? (
      <main className="wrap">
        <h1>Integração com o backend</h1>
        <p className="meta">Os dados desta tela vêm da API HTTP do backend.</p>
        <div className="pilha">
          <PredictionForm />
          <HistoricoBusca />
        </div>
      </main>
      ) : (
      <main className="wrap">
        <h1>Onde vai chover em Londrina hoje?</h1>
        <p className="meta">
          {meta?.updatedAt ? `Último registro do banco: ${fmtDateTime(meta.updatedAt)}` : 'Horário do último registro indisponível'}
          {loading && ' · atualizando…'}
        </p>
        {meta?.dbError && <p className="err" role="alert">Não foi possível ler o banco: {meta.dbError}</p>}
        {error && <p className="err" role="alert">Não foi possível carregar os dados: {error} Tente novamente em instantes.</p>}

        <section id="mapa" aria-labelledby="t-mapa">
          <div className="map-grid">
            <div className="card">
              <h2 id="t-mapa">Mapa de Londrina</h2>
              {errs.station && <p className="err" role="alert">Não foi possível ler o ponto de medição: {errs.station}</p>}
              <Suspense fallback={<Empty>Carregando mapa…</Empty>}>
                <CityMap station={data?.station} city={data?.city} at={meta?.updatedAt} />
              </Suspense>
            </div>
            <Rain24h rain={data?.rain24h} error={errs.series} />
          </div>
        </section>

        <section id="agora" aria-labelledby="t-agora">
          <h2 id="t-agora" className="sr">Agora</h2>
          <Indicators city={data?.city} climate={data?.climate} rainPeak={data?.rainPeak} peakError={errs.series} at={meta?.updatedAt} error={errs.current} />
          <div className="grid2">
            <div className="card"><h3>Chuva nas últimas 24h (mm)</h3><p className="note">Registros observados · cidade toda · último registro em destaque</p>
              {errs.series ? <p className="err" role="alert">Não foi possível ler o banco: {errs.series}</p> : <RainBars data={data?.hourly} />}</div>
            <div className="card"><h3>Temperatura nas últimas 24h (°C)</h3><p className="note">Registros observados · cidade toda · último registro em destaque</p>
              {errs.series ? <p className="err" role="alert">Não foi possível ler o banco: {errs.series}</p> : <TempLine data={data?.hourly} />}</div>
          </div>
        </section>

        <section id="semana" aria-labelledby="t-semana">
          <h2 id="t-semana">Últimos 7 dias</h2>
          <p className="note">Chuva acumulada no dia · temperatura máxima / mínima · registros observados{lastDay ? ` até ${fmtDay(lastDay)}` : ''}</p>
          <LastDays days={data?.daily} error={errs.days} />
        </section>

        <section id="dados" className="grid2">
          <div className="card">
            <h2>Histórico do mês</h2><MonthPanel month={data?.month} error={errs.history} />
            <div className="about"><h3>Como lemos os dados</h3>
              <p>{meta?.about ?? 'A descrição da origem dos dados, do modelo e da frequência de atualização ainda não foi informada.'}</p></div>
          </div>
          <RainEvents events={data?.rainEvents} error={errs.events} />
          <div className="card compare-card"><PeriodComparison latestDate={meta?.updatedAt} /></div>
        </section>

      </main>
      )}

      <footer className="wrap foot">
        {/* Fontes reunidas só aqui (no mapa fica apenas o crédito obrigatório do OpenStreetMap) */}
        <div className="sources">
          <span><b>Chuva Londrina</b> · protótipo acadêmico · UTFPR Londrina</span>
          <span>Fonte dos dados: {meta?.source ?? 'não informada'} · Último dado recebido: {fmtFullDateTime(meta?.updatedAt) ?? 'indisponível'}</span>
          <span>Limite municipal: IBGE (malha municipal 2022) · Mapa: © OpenStreetMap</span>
        </div>
        <a href={RAIZ} onClick={(e) => irPara(e, 'mapa')}>Voltar ao início</a>
      </footer>
    </>
  );
}

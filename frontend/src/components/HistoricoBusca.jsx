import { useEffect, useRef, useState } from 'react';
import { buscarHistorico } from '../services/previsaoApi.js';
import { TZ } from '../lib/format.js';
import { Empty } from './Panels.jsx';
import ResultadoPrevisao from './ResultadoPrevisao.jsx';

// Intervalo do dataset no banco (consultado em 02/11/2026: registros de 01/01/2020 a 30/09/2026).
const DATA_MIN = '2020-01-01';
const DATA_MAX = '2026-09-30';

const fmtData = (d) => new Date(`${d}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: TZ });

export default function HistoricoBusca() {
  const [data, setData] = useState(DATA_MAX);
  const [busca, setBusca] = useState({ status: 'ocioso' }); // ocioso | carregando | sucesso | vazio | erro
  const pedido = useRef(null);

  useEffect(() => () => pedido.current?.abort(), []);

  async function buscar(e) {
    e.preventDefault();
    if (!data || data < DATA_MIN || data > DATA_MAX) {
      setBusca({ status: 'erro', mensagem: `Escolha uma data entre ${fmtData(DATA_MIN)} e ${fmtData(DATA_MAX)}.` });
      return;
    }
    pedido.current?.abort();
    const ctrl = (pedido.current = new AbortController());
    setBusca({ status: 'carregando', data });
    try {
      const resultado = await buscarHistorico(data, { signal: ctrl.signal });
      setBusca(resultado ? { status: 'sucesso', data, resultado } : { status: 'vazio', data });
    } catch (err) {
      if (err?.name !== 'AbortError') setBusca({ status: 'erro', mensagem: err.message });
    }
  }

  const carregando = busca.status === 'carregando';
  return (
    <div>
      <form className="card busca" onSubmit={buscar} aria-labelledby="t-historico">
        <h2 id="t-historico">Consultar histórico por data</h2>
        <p className="note">Busca no backend (GET) a previsão registrada para o dia: se ia chover e a probabilidade. Dados disponíveis de {fmtData(DATA_MIN)} a {fmtData(DATA_MAX)}.</p>
        <div className="acoes">
          <div className="campo">
            <label htmlFor="hist-data">Data</label>
            <input id="hist-data" type="date" min={DATA_MIN} max={DATA_MAX} required value={data} onChange={(e) => setData(e.target.value)} disabled={carregando} />
          </div>
          <button type="submit" className="btn" disabled={carregando}>{carregando ? 'Buscando…' : 'Buscar'}</button>
        </div>
      </form>
      <div className="resultado" aria-live="polite">
        {carregando && <Empty>Buscando dados de {fmtData(busca.data)}…</Empty>}
        {busca.status === 'erro' && <p className="err" role="alert">Não foi possível buscar o histórico: {busca.mensagem}</p>}
        {busca.status === 'vazio' && <Empty>Sem previsão registrada para {fmtData(busca.data)}. Escolha outra data.</Empty>}
        {busca.status === 'sucesso' && <ResultadoPrevisao resultado={busca.resultado} legenda={`Previsão do modelo registrada para ${fmtData(busca.data)}`} />}
      </div>
    </div>
  );
}

import { CAMPOS, fmtValor } from '../lib/camposPrevisao.js';
import { pct } from '../lib/format.js';

const IconeChuva = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M7 15a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18 8.5 3.5 3.5 0 0 1 17.5 15z" /><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" />
  </svg>
);
const IconeSol = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

// Previsão devolvida pelo backend (o front só exibe). "enviados": os 4 valores enviados, quando houver.
export default function ResultadoPrevisao({ resultado: { vaiChover, probabilidadePct }, legenda, enviados }) {
  return (
    <div className="card previsao" role="status" aria-label="Resultado da previsão">
      <p className={`veredito ${vaiChover ? 'chuva' : 'seco'}`}>
        {vaiChover ? <IconeChuva /> : <IconeSol />}
        <strong>{vaiChover ? 'Vai chover' : 'Não vai chover'}</strong>
      </p>
      <p className="prob"><strong>{pct(probabilidadePct)}</strong> de probabilidade de chuva</p>
      <p className="note">{legenda}</p>
      {enviados && <p className="note">Dados enviados: {CAMPOS.map((c) => `${c.rotulo} ${fmtValor(enviados[c.id], c.unidade)}`).join(' · ')}</p>}
    </div>
  );
}

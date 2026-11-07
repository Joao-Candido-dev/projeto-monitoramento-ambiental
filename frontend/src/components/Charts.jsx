import { fmtHour, mm, celsius } from '../lib/format.js';

const W = 480, H = 210, P = { l: 36, r: 10, t: 14, b: 28 };
// Com muitas barras, rotula uma a cada 3 (sempre incluindo o último registro) para não encavalar.
const showTick = (i, n) => n <= 12 || (n - 1 - i) % 3 === 0;

function Frame({ ticks, fmtTick, ymin = 0, ymax, children, label }) {
  const y = (v) => P.t + (H - P.t - P.b) * (1 - (v - ymin) / (ymax - ymin));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="chart">
      {ticks.map((t) => (
        <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#E5E7EB" /><text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="tick">{fmtTick(t)}</text></g>
      ))}
      {children(y)}
    </svg>
  );
}

// Séries observadas, do mais antigo para o mais recente; o último registro fica em destaque.
export function RainBars({ data }) {
  const rows = (data ?? []).filter((d) => d.mm != null);
  if (!rows.length) return <p className="empty">Gráfico indisponível: sem registros de chuva para o período.</p>;
  const ymax = Math.max(5, Math.ceil(Math.max(...rows.map((d) => d.mm)) / 5) * 5);
  const sel = rows.at(-1);
  const bw = (W - P.l - P.r) / rows.length;
  return (
    <Frame ticks={[0, Math.round(ymax / 2), ymax]} fmtTick={(t) => t} ymax={ymax} label="Chuva registrada nas últimas 24 horas, em milímetros">
      {(y) => rows.map((d, i) => (
        <g key={d.t} tabIndex={0} aria-label={`${fmtHour(d.t)}: ${mm(d.mm)}`}>
          <rect x={P.l + i * bw + 2} width={Math.max(1, bw - 4)} y={y(d.mm)} height={H - P.b - y(d.mm)} rx="3"
            fill={d === sel ? '#2563EB' : '#78A9DF'}><title>{`${fmtHour(d.t)} · ${mm(d.mm)}`}</title></rect>
          {showTick(i, rows.length) && <text x={P.l + i * bw + bw / 2} y={H - 9} textAnchor="middle" className={d === sel ? 'tick on' : 'tick'}>{fmtHour(d.t)}</text>}
        </g>
      ))}
    </Frame>
  );
}

export function TempLine({ data }) {
  const rows = (data ?? []).filter((d) => d.tempC != null);
  if (rows.length < 2) return <p className="empty">Gráfico indisponível: registros de temperatura insuficientes.</p>;
  const vals = rows.map((d) => d.tempC);
  const ymin = Math.floor(Math.min(...vals) / 5) * 5;
  const ymax = Math.max(ymin + 5, Math.ceil(Math.max(...vals) / 5) * 5);
  const sel = rows.at(-1);
  const step = (W - P.l - P.r) / (rows.length - 1);
  return (
    <Frame ticks={[ymin, Math.round((ymin + ymax) / 2), ymax]} fmtTick={(t) => `${t}°`} ymin={ymin} ymax={ymax} label="Temperatura registrada nas últimas 24 horas, em graus Celsius">
      {(y) => {
        const pts = rows.map((d, i) => [P.l + i * step, y(d.tempC), d]);
        const line = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x},${yy}`).join(' ');
        return (
          <>
            <path d={`${line} L${pts.at(-1)[0]},${y(ymin)} L${P.l},${y(ymin)}Z`} fill="#EAF2FC" />
            <path d={line} fill="none" stroke="#2563EB" strokeWidth="2.5" />
            {pts.map(([x, yy, d], i) => (
              <g key={d.t} tabIndex={0} aria-label={`${fmtHour(d.t)}: ${celsius(d.tempC)}`}>
                <circle cx={x} cy={yy} r={d === sel ? 6 : 3.5} fill={d === sel ? '#173B67' : '#2563EB'} stroke="#fff" strokeWidth="2"><title>{`${fmtHour(d.t)} · ${celsius(d.tempC)}`}</title></circle>
                {showTick(i, rows.length) && <text x={x} y={H - 9} textAnchor={i === rows.length - 1 ? 'end' : 'middle'} className={d === sel ? 'tick on' : 'tick'}>{fmtHour(d.t)}</text>}
              </g>
            ))}
          </>
        );
      }}
    </Frame>
  );
}

export const TZ = 'America/Sao_Paulo';

const num = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? null : Number(v).toFixed(d).replace('.', ','));
const wrap = (v, u, d, sp = ' ') => (num(v, d) == null ? 'indisponível' : `${num(v, d)}${sp}${u}`);
export const mm = (v) => wrap(v, 'mm', Number(v) % 1 === 0 ? 0 : 1); // 0,1 mm não pode virar "0 mm"
export const pct = (v) => wrap(v, '%', 0, '');
export const kmh = (v) => wrap(v, 'km/h', 0);
export const celsius = (v) => wrap(v, '°C', 0);

// Escala de Beaufort (km/h): cada nome vale a partir do limite indicado até o próximo.
const BEAUFORT = [[118, 'furacão'], [103, 'tempestade violenta'], [89, 'tempestade'], [75, 'ventania forte'], [62, 'ventania'],
  [50, 'vento forte'], [39, 'vento fresco'], [29, 'brisa forte'], [20, 'brisa moderada'], [12, 'brisa fraca'], [6, 'brisa leve'], [1, 'aragem'], [0, 'calmaria']];
export const beaufort = (kmhValue) => (kmhValue == null ? null : BEAUFORT.find(([min]) => kmhValue >= min)?.[1] ?? 'calmaria');

// Fuso da coluna "time" do banco (única função que trata disso).
// - Com offset ou Z (timestamptz): mantém; a formatação abaixo converte para America/Sao_Paulo.
// - Sem offset (timestamp, o que o banco devolve hoje, ex. "2026-09-30T23:00:00"): já é o horário local
//   de Londrina (o SQL da equipe o chama de "horario_londrina"). Acrescenta -03:00, o fuso fixo de
//   Londrina desde o fim do horário de verão (2019; a série começa em 2020), então a hora exibida é a do banco.
export const dbTimeToIso = (v) => {
  if (v == null || v === '') return null;
  const s = String(v).trim().replace(' ', 'T');
  const iso = /([zZ]|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}-03:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
};

const fmt = (iso, opts) => (iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...opts }).format(new Date(iso)) : null);
// Data completa para o rodapé: "30/09/2026 às 23:00" (hora de Londrina).
export const fmtFullDateTime = (iso) => (iso ? `${fmt(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })} às ${fmt(iso, { hour: '2-digit', minute: '2-digit' })}` : null);
export const fmtDateTime = (iso) => fmt(iso, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtHour = (iso) => (iso ? fmt(iso, { hour: '2-digit', hour12: false }).replace(/\D/g, '') + 'h' : '—');
export const fmtDay = (d) => fmt(`${d}T12:00:00-03:00`, { weekday: 'short', day: '2-digit' });

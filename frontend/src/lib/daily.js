// Agrupa registros horários em dias (data local de Londrina) e devolve os 7 dias mais recentes,
// do mais antigo para o mais recente. Chuva = soma do dia; temperatura = mínima e máxima do dia.
// t vem de dbTimeToIso ("2026-09-30T23:00:00-03:00"): os 10 primeiros caracteres já são a data local.
// Chance histórica: porcentagem de dias com pelo menos minMm de chuva (soma do dia). Não é previsão.
export function rainChance(rows, minMm = 1) {
  const days = dailyFromHours(rows, Infinity).filter((d) => d.rainMm != null);
  const rainyDays = days.filter((d) => d.rainMm >= minMm).length;
  return { pct: days.length ? Math.round((100 * rainyDays) / days.length) : null, days: days.length, rainyDays };
}

const round1 = (v) => Math.round(v * 10) / 10;
const sumMm = (rows) => round1((rows ?? []).reduce((s, r) => s + (r?.mm ?? 0), 0));

// Histórico do mês: acumulado do mês no ano do último registro x média do mesmo mês nos anos anteriores.
// rowsByYear: { 2024: [{ t, mm }], ... }. Ano anterior com menos de 90% das horas do mês fica fora da média.
export function monthSummary(rowsByYear, year, month) {
  const hoursInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate() * 24;
  const complete = Object.keys(rowsByYear).map(Number).sort((a, b) => a - b)
    .filter((y) => y < year && (rowsByYear[y]?.length ?? 0) >= 0.9 * hoursInMonth);
  return {
    accumulatedMm: sumMm(rowsByYear[year]),
    historicalAvgMm: complete.length ? round1(complete.reduce((s, y) => s + sumMm(rowsByYear[y]), 0) / complete.length) : null,
    fromYear: complete[0] ?? null,
    toYear: complete.at(-1) ?? null,
  };
}

export function dailyFromHours(rows, days = 7) {
  const byDate = new Map();
  for (const r of rows ?? []) {
    const date = typeof r?.t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.t) ? r.t.slice(0, 10) : null;
    if (!date) continue;
    const d = byDate.get(date) ?? { date, rain: [], temp: [] };
    if (r.mm != null) d.rain.push(r.mm);
    if (r.tempC != null) d.temp.push(r.tempC);
    d.hours = (d.hours ?? 0) + 1;
    byDate.set(date, d);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
    .map(({ date, rain, temp, hours }) => ({
      date,
      rainMm: rain.length ? Math.round(rain.reduce((s, v) => s + v, 0) * 10) / 10 : null,
      tMin: temp.length ? Math.min(...temp) : null,
      tMax: temp.length ? Math.max(...temp) : null,
      hours,
    }));
}

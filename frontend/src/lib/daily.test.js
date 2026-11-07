import { describe, it, expect } from 'vitest';
import { dailyFromHours, rainChance, monthSummary } from './daily.js';

describe('monthSummary', () => {
  // n horas de setembro (30 dias = 720 h) com chuva mm em cada hora
  const sept = (year, n, mm) => Array.from({ length: n }, (_, i) => ({ t: `${year}-09-${String(1 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00-03:00`, mm }));
  it('acumulado do ano do último registro x média do mesmo mês nos anos completos anteriores', () => {
    const byYear = { 2024: sept(2024, 720, 0.1), 2025: sept(2025, 720, 0.2), 2026: sept(2026, 720, 0.5) };
    expect(monthSummary(byYear, 2026, 9)).toEqual({ accumulatedMm: 360, historicalAvgMm: 108, fromYear: 2024, toYear: 2025 });
  });
  it('ano anterior com o mês incompleto (menos de 90% das horas) fica fora da média', () => {
    const byYear = { 2023: sept(2023, 100, 5), 2024: sept(2024, 720, 0.1), 2026: sept(2026, 24, 1) };
    expect(monthSummary(byYear, 2026, 9)).toEqual({ accumulatedMm: 24, historicalAvgMm: 72, fromYear: 2024, toYear: 2024 });
  });
  it('sem anos anteriores: média null', () => {
    expect(monthSummary({ 2026: sept(2026, 24, 1) }, 2026, 9)).toEqual({ accumulatedMm: 24, historicalAvgMm: null, fromYear: null, toYear: null });
  });
});

describe('rainChance', () => {
  // 4 dias: 2 com chuva ≥ 1 mm no dia (somando as horas), 1 com só 0,5 mm, 1 seco
  const rows = [
    { t: '2025-09-01T10:00:00-03:00', mm: 0.6 }, { t: '2025-09-01T11:00:00-03:00', mm: 0.6 },
    { t: '2025-09-02T10:00:00-03:00', mm: 5 },
    { t: '2025-09-03T10:00:00-03:00', mm: 0.5 },
    { t: '2025-09-04T10:00:00-03:00', mm: 0 },
  ];
  it('porcentagem de dias com pelo menos 1 mm de chuva', () => {
    expect(rainChance(rows)).toEqual({ pct: 50, days: 4, rainyDays: 2 });
  });
  it('sem dados: porcentagem null', () => {
    expect(rainChance([])).toEqual({ pct: null, days: 0, rainyDays: 0 });
  });
});

// horas no formato que o frontend usa depois de dbTimeToIso (hora de Londrina, -03:00)
const h = (date, hour, mm, tempC) => ({ t: `${date}T${String(hour).padStart(2, '0')}:00:00-03:00`, mm, tempC });

describe('dailyFromHours', () => {
  it('soma a chuva e acha mín./máx. de cada dia, do mais antigo para o mais recente', () => {
    const rows = [h('2026-09-30', 23, 0.5, 20), h('2026-09-29', 1, 1, 18), h('2026-09-30', 1, 0.2, 25), h('2026-09-29', 2, 2.15, 22)];
    expect(dailyFromHours(rows)).toEqual([
      { date: '2026-09-29', rainMm: 3.2, tMin: 18, tMax: 22, hours: 2 },
      { date: '2026-09-30', rainMm: 0.7, tMin: 20, tMax: 25, hours: 2 },
    ]);
  });
  it('mantém só os 7 dias mais recentes', () => {
    const rows = Array.from({ length: 9 }, (_, i) => h(`2026-09-${String(20 + i).padStart(2, '0')}`, 12, 1, 20));
    const days = dailyFromHours(rows);
    expect(days.map((d) => d.date)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']);
  });
  it('dia sem nenhum valor de chuva ou temperatura fica com null (não com 0)', () => {
    expect(dailyFromHours([h('2026-09-30', 1, null, null)])).toEqual([{ date: '2026-09-30', rainMm: null, tMin: null, tMax: null, hours: 1 }]);
  });
  it('ignora horas sem data válida e lista vazia não quebra', () => {
    expect(dailyFromHours([{ t: null, mm: 5, tempC: 20 }])).toEqual([]);
    expect(dailyFromHours(undefined)).toEqual([]);
  });
});

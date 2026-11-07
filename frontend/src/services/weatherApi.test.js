import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../test/dbFixture.js';

// Cada teste carrega o módulo do zero (o cache de 5 min fica dentro dele).
const load = async ({ configured = true, fail = [] } = {}) => {
  vi.resetModules();
  vi.doMock('../lib/supabase.js', () => ({ supabase: configured ? {} : null }));
  const answer = (name, value) => (fail.includes(name) ? () => Promise.reject(new Error(`falha em ${name}`)) : () => Promise.resolve(value));
  vi.doMock('./forecastRepo.js', () => ({
    getCurrent: answer('current', db.current), getLast24h: answer('series', db.last24), getLastDays: answer('days', db.lastDays),
    getRainEvents: answer('events', db.events), getStation: answer('station', db.station),
    getMonthHours: fail.includes('history') ? () => Promise.reject(new Error('falha em history')) : (_s, y, m) => Promise.resolve(db.monthHours(y, m)),
  }));
  return (await import('./weatherApi.js')).getForecast;
};
const ALL = ['current', 'series', 'days', 'events', 'station', 'history'];

describe('getForecast (sempre dados do banco)', () => {
  beforeEach(() => vi.resetModules());

  it('sem .env configurado: erro claro, nenhum número inventado', async () => {
    const getForecast = await load({ configured: false });
    await expect(getForecast()).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it('banco fora do ar: avisa o erro e todos os blocos ficam vazios (sem demonstração)', async () => {
    const d = await (await load({ fail: ALL }))();
    expect(d.meta.dbError).toMatch(/falha em/);
    expect(d.city).toBeNull();
    expect(d.hourly).toEqual([]);
    expect(d.daily).toEqual([]);
    expect(d.rainEvents).toEqual([]);
    expect(d.rainPeak).toBeNull();
    expect(d.month).toBeNull();
    expect(d).not.toHaveProperty('alert');
  });

  it('maior chuva das últimas 24h vem da série do banco', async () => {
    const d = await (await load())();
    expect(d.rainPeak).toEqual({ mm: 3.9, t: '2026-09-30T13:00:00-03:00' });
    expect(d.meta.dbError).toBeNull();
    expect(Object.values(d.meta.errors).every((e) => e == null)).toBe(true);
  });

  it('chuva acumulada nas últimas 24h: soma dos 24 registros, com o período', async () => {
    const d = await (await load())();
    expect(d.rain24h).toEqual({ mm: 5.1, from: '2026-09-30T00:00:00-03:00', to: '2026-09-30T23:00:00-03:00' });
  });

  it('chuva acumulada fica vazia se a série das 24h falhar', async () => {
    const d = await (await load({ fail: ['series'] }))();
    expect(d.rain24h).toBeNull();
    expect(d.meta.errors.series).toMatch(/falha em series/);
  });

  it('uma consulta com erro afeta só o bloco dela', async () => {
    const d = await (await load({ fail: ['events'] }))();
    expect(d.meta.errors.events).toMatch(/falha em events/);
    expect(d.rainEvents).toEqual([]);
    expect(d.city.tempC).toBe(23.6);
  });
});

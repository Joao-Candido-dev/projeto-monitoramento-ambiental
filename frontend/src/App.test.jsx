import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as db from './test/dbFixture.js';

// A página só mostra dados do banco: nos testes, o "banco" são as respostas de dbFixture.js.
vi.mock('./lib/supabase.js', () => ({ supabase: {} }));
vi.mock('./services/forecastRepo.js', async () => {
  const fx = await import('./test/dbFixture.js');
  return {
    getCurrent: async () => fx.current, getLast24h: async () => fx.last24, getLastDays: async () => fx.lastDays,
    getRainEvents: async () => fx.events, getStation: async () => fx.station, getMonthHours: async (_s, y, m) => fx.monthHours(y, m),
    getDayHours: async (_s, y, m, d) => fx.monthHours(y, m).filter((row) => Number(row.horario.slice(8, 10)) === d),
    getMonthsWithData: async (_s, y) => Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => fx.monthHours(y, m).length),
    getYearsWithData: async (_s, first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i)
      .filter((y) => Array.from({ length: 12 }, (_, i) => i + 1).some((m) => fx.monthHours(y, m).length)),
  };
});
const { default: App } = await import('./App.jsx');

const ready = () => screen.findByText(/Último registro do banco: qua\., 30 de set\., 23:00/);

describe('App (dados do banco)', () => {
  it('carrega sob StrictMode e encerra o "atualizando…"', async () => {
    render(<StrictMode><App /></StrictMode>);
    await ready();
    await waitFor(() => expect(screen.queryByText(/atualizando/)).toBeNull());
    expect(screen.getByRole('group', { name: /^Indicadores/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Chuva nas últimas 24h (mm)' })).toBeTruthy();
  });
  it('ao lado do mapa: chuva acumulada nas últimas 24h (sem o card "Clima atual")', async () => {
    render(<App />);
    await ready();
    const card = screen.getByRole('heading', { name: 'Chuva acumulada nas últimas 24h' }).closest('section');
    expect(card.closest('#mapa')).toBeTruthy();
    expect(card.querySelector('strong').textContent).toBe('5,1 mm'); // 3,9 + 0,7 + 0,5 no fixture
    expect(screen.queryByRole('heading', { name: 'Clima atual' })).toBeNull();
    expect(screen.queryByText(/Alerta/)).toBeNull();
  });
  it('maior chuva das últimas 24h nos indicadores, no lugar de "Chuva no último registro"', async () => {
    render(<App />);
    await ready();
    const kpi = screen.getByText('Maior chuva nas últimas 24h').closest('.kpi');
    expect(kpi.closest('#agora')).toBeTruthy();
    expect(kpi.textContent).toContain('3,9 mm');
    expect(screen.queryByText('Chuva no último registro')).toBeNull();
  });
  it('nenhum bloco de demonstração', async () => {
    const { container } = render(<App />);
    await ready();
    expect(container.textContent).not.toMatch(/demonstração/i);
  });
  it('mapa de Londrina no topo, com o ponto de medição', async () => {
    render(<App />);
    await ready();
    expect(screen.getByRole('heading', { name: 'Mapa de Londrina' })).toBeTruthy();
    // o mapa carrega à parte (lazy): espera o elemento do mapa, não a seção
    expect(await screen.findByRole('region', { name: /limite do município/ })).toBeTruthy();
    expect(await screen.findByText(/Ponto de medição dos dados/)).toBeTruthy();
  });
  it('últimos 7 dias observados', async () => {
    render(<App />);
    await ready();
    expect(screen.getByRole('heading', { name: /^Últimos 7 dias/ })).toBeTruthy();
    expect(screen.getByRole('list', { name: /últimos 7 dias/ }).querySelectorAll('li')).toHaveLength(7);
  });
  it('fonte só no rodapé, com o dia e o horário do último dado recebido', async () => {
    render(<App />);
    await ready();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain('Fonte dos dados: Banco do projeto (Supabase) · Londrina');
    expect(footer.textContent).toContain('Último dado recebido: 30/09/2026 às 23:00');
    expect(footer.textContent).toContain('Limite municipal: IBGE (malha municipal 2022)');
    expect(footer.textContent).toContain('Mapa: © OpenStreetMap');
    const main = screen.getByRole('main');
    expect(main.textContent).not.toMatch(/Fonte/);
    expect(main.querySelector('.meta').textContent).toContain('Último registro do banco: qua., 30 de set., 23:00');
  });
  it('não mostra nada de regiões', async () => {
    const { container } = render(<App />);
    await ready();
    expect(container.textContent).not.toMatch(/regi[ãa]o|regiões/i);
  });
  it('usa os dados do fixture (prova de que nada vem de outro lugar)', async () => {
    render(<App />);
    await ready();
    expect(screen.getByText('Este mês: 6 mm')).toBeTruthy(); // 3 dias × 2 mm em setembro/2026 no fixture
    expect(db.current.cidade).toBe('Londrina');
  });
});

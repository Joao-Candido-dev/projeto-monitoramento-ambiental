import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import L from 'leaflet';
import CityMap from './CityMap.jsx';
import boundary from '../data/londrina-ibge.json';

const city = { rainMm: 0.4, tempC: 23.6 };
const station = { lat: -23.304, lon: -51.186 };

describe('CityMap', () => {
  afterEach(() => vi.restoreAllMocks());

  it('desenha o limite de Londrina e o ponto de medição', () => {
    const { container } = render(<CityMap station={station} city={city} at="2026-09-30T23:00:00-03:00" />);
    expect(screen.getByRole('region', { name: /Mapa de Londrina/ })).toBeTruthy();
    expect(container.querySelectorAll('path.leaflet-interactive')).toHaveLength(2); // limite do município + ponto
    expect(screen.getByText(/Ponto de medição dos dados/).textContent).toContain('-23,304');
  });
  it('sem ponto de medição: mostra só o limite e avisa', () => {
    const { container } = render(<CityMap station={null} city={city} />);
    expect(container.querySelectorAll('path.leaflet-interactive')).toHaveLength(1);
    expect(screen.getByText(/Ponto de medição indisponível/)).toBeTruthy();
  });
  it('sem botões extras no mapa', () => {
    render(<CityMap station={station} city={city} />);
    expect(screen.queryByRole('button', { name: /Ver (município|a cidade)/ })).toBeNull();
  });
  it('limite do município é a malha oficial do IBGE em qualidade máxima (não a simplificada)', () => {
    const ring = boundary.features[0].geometry.coordinates[0];
    expect(boundary.features[0].properties.codarea).toBe('4113700');
    expect(ring.length).toBeGreaterThan(900);
  });
  it('ao carregar, enquadra o município inteiro (mesmo com o ponto de medição)', () => {
    const fit = vi.spyOn(L.Map.prototype, 'fitBounds');
    render(<CityMap station={station} city={city} />);
    const area = L.geoJSON(boundary).getBounds();
    const last = L.latLngBounds(fit.mock.calls.at(-1)[0]);
    expect(last.equals(area)).toBe(true);
  });
  it('no mapa fica só o crédito obrigatório do OpenStreetMap; as fontes vão para o rodapé', () => {
    const { container } = render(<CityMap station={station} city={city} />);
    const credit = container.querySelector('.leaflet-control-attribution').textContent;
    expect(credit).toContain('OpenStreetMap');
    expect(credit).not.toContain('IBGE');
    expect(container.textContent).not.toMatch(/(IBGE)|Fonte/);
  });
});

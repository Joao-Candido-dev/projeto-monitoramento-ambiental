import { describe, it, expect } from 'vitest';
import { dbTimeToIso, mm, beaufort } from './format.js';

describe('dbTimeToIso', () => {
  it('horário sem fuso (como vem do banco) é tratado como hora de Londrina', () => {
    expect(dbTimeToIso('2026-09-30T23:00:00')).toBe('2026-09-30T23:00:00-03:00');
  });
  it('horário com fuso é mantido', () => {
    expect(dbTimeToIso('2026-09-30T23:00:00+00:00')).toBe('2026-09-30T23:00:00+00:00');
  });
  it('vazio ou inválido vira null', () => {
    expect(dbTimeToIso(null)).toBeNull();
    expect(dbTimeToIso('')).toBeNull();
    expect(dbTimeToIso('não é data')).toBeNull();
  });
});

describe('mm', () => {
  it('mostra casa decimal só quando existe', () => {
    expect(mm(0.1)).toBe('0,1 mm');
    expect(mm(12)).toBe('12 mm');
  });
  it('valor ausente vira "indisponível"', () => {
    expect(mm(null)).toBe('indisponível');
  });
});

describe('beaufort', () => {
  it('descreve a velocidade do vento (km/h) pela escala de Beaufort', () => {
    expect(beaufort(0.5)).toBe('calmaria');
    expect(beaufort(8.5)).toBe('brisa leve');
    expect(beaufort(17.4)).toBe('brisa fraca');
    expect(beaufort(45)).toBe('vento fresco');
    expect(beaufort(130)).toBe('furacão');
  });
  it('limites da escala: 6 km/h já é brisa leve, 5,9 ainda é aragem', () => {
    expect(beaufort(5.9)).toBe('aragem');
    expect(beaufort(6)).toBe('brisa leve');
  });
  it('sem valor devolve null', () => {
    expect(beaufort(null)).toBeNull();
  });
});

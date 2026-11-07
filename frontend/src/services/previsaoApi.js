// Comunicação HTTP com o backend. TODO o contrato (rotas, nomes dos campos, formato) fica só neste arquivo.

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
const TIMEOUT_MS = 10_000;

const ROTA_PREVISAO = '/previsao';
const ROTA_HISTORICO = '/historico'; // ?data=AAAA-MM-DD

// id do campo na tela (lib/camposPrevisao.js) → nome do campo no JSON do backend
const CAMPOS_JSON = {
  temperatura: 'temperature_2m',
  umidade: 'relative_humidity_2m',
  pressao: 'pressure_msl',
  nebulosidade: 'cloud_cover',
};

// VER COM A EQUIPE DO BACKEND: confirmar nomes dos campos de resposta e escala da probabilidade (0-1 ou 0-100).
// campo normalizado no front → nome do campo na resposta do POST /previsao
const RESPOSTA_JSON = {
  vaiChover: 'vai_chover', // boolean
  probabilidade: 'probabilidade', // número
};
// Escala da probabilidade que o backend manda: 1 = de 0 a 1; 100 = de 0 a 100.
const PROBABILIDADE_ESCALA = 1;

const NAO_CONFIGURADO = 'Backend não configurado: preencha VITE_API_URL no arquivo .env e reinicie o npm run dev.';

const numero = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Mensagem do corpo de erro, se o backend mandar uma (o formato ainda não foi combinado).
const detalhe = (corpo) => {
  const m = corpo?.mensagem ?? corpo?.message ?? corpo?.detail ?? corpo?.error;
  return typeof m === 'string' && m.trim() ? ` ${m.trim()}` : '';
};
const erroHttp = (status, corpo) => new Error(`O servidor respondeu com erro ${status}.${detalhe(corpo)}`);

async function requisitar(rota, { signal, method = 'GET', json } = {}) {
  if (!BASE_URL) throw new Error(NAO_CONFIGURADO);
  const ctrl = new AbortController();
  let estourou = false;
  const timer = setTimeout(() => { estourou = true; ctrl.abort(); }, TIMEOUT_MS);
  const cancelar = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  signal?.addEventListener('abort', cancelar, { once: true });
  try {
    const res = await fetch(`${BASE_URL}${rota}`, {
      method,
      headers: json ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: json ? JSON.stringify(json) : undefined,
      signal: ctrl.signal,
    });
    const texto = await res.text();
    let corpo = null;
    try { corpo = texto ? JSON.parse(texto) : null; } catch { /* corpo não é JSON: só o status importa */ }
    return { status: res.status, ok: res.ok, corpo };
  } catch (e) {
    if (estourou) throw new Error(`O servidor demorou mais de ${TIMEOUT_MS / 1000} segundos para responder. Tente novamente.`, { cause: e });
    if (e?.name === 'AbortError') throw e; // cancelado pela tela (ex.: componente saiu)
    throw new Error('Não foi possível conectar ao backend. Verifique a internet e se o servidor está no ar.', { cause: e });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelar);
  }
}

// Só converte o formato e a escala: a previsão é do modelo do backend, o front não calcula nada.
function normalizarPrevisao(corpo) {
  const vaiChover = corpo?.[RESPOSTA_JSON.vaiChover];
  const probabilidade = numero(corpo?.[RESPOSTA_JSON.probabilidade]);
  if (typeof vaiChover !== 'boolean' || probabilidade == null) throw new Error('Resposta inesperada do servidor.');
  const probabilidadePct = (probabilidade / PROBABILIDADE_ESCALA) * 100;
  if (probabilidadePct < 0 || probabilidadePct > 100) throw new Error('Resposta inesperada do servidor: probabilidade fora da escala esperada.');
  return { vaiChover, probabilidadePct };
}

// dados: { temperatura, umidade, pressao, nebulosidade } (números). Devolve { vaiChover, probabilidadePct (0 a 100) }.
export async function enviarPrevisao(dados, { signal } = {}) {
  const json = Object.fromEntries(Object.entries(CAMPOS_JSON).map(([id, nome]) => [nome, dados[id]]));
  const { ok, status, corpo } = await requisitar(ROTA_PREVISAO, { signal, method: 'POST', json });
  if (!ok) throw erroHttp(status, corpo);
  return normalizarPrevisao(corpo);
}

// data: "AAAA-MM-DD". Previsão registrada para o dia, no mesmo formato da resposta do POST /previsao.
// Devolve { vaiChover, probabilidadePct (0 a 100) } ou null se não houver previsão para a data (404).
// VER COM A EQUIPE DO BACKEND: confirmar se o dia traz uma previsão só ou uma lista (hoje, de uma lista usa a primeira).
export async function buscarHistorico(data, { signal } = {}) {
  const { ok, status, corpo } = await requisitar(`${ROTA_HISTORICO}?data=${encodeURIComponent(data)}`, { signal });
  if (status === 404) return null;
  if (!ok) throw erroHttp(status, corpo);
  const linha = Array.isArray(corpo) ? corpo[0] : corpo;
  if (linha == null) return null;
  return normalizarPrevisao(linha);
}

import { useEffect, useRef, useState } from 'react';
import { enviarPrevisao } from '../services/previsaoApi.js';
import { CAMPOS, fmtValor } from '../lib/camposPrevisao.js';
import ResultadoPrevisao from './ResultadoPrevisao.jsx';

const VAZIO = Object.fromEntries(CAMPOS.map((c) => [c.id, '']));

// Aceita vírgula decimal ("23,5"). Devolve { dados } com números ou { erros } por campo.
function validar(valores) {
  const dados = {}, erros = {};
  for (const c of CAMPOS) {
    const t = valores[c.id].trim().replace(',', '.');
    if (!t) erros[c.id] = 'Preencha este campo.';
    else if (!/^-?\d+(\.\d+)?$/.test(t)) erros[c.id] = 'Digite um número (ex.: 23,5).';
    else if (Number(t) < c.min || Number(t) > c.max) erros[c.id] = `Use um valor entre ${fmtValor(c.min, c.unidade)} e ${fmtValor(c.max, c.unidade)}.`;
    else dados[c.id] = Number(t);
  }
  return Object.keys(erros).length ? { erros } : { dados };
}

export default function PredictionForm() {
  const [valores, setValores] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [envio, setEnvio] = useState({ status: 'ocioso' }); // ocioso | enviando | sucesso (resultado, enviados) | erro (mensagem)
  const pedido = useRef(null);

  useEffect(() => () => pedido.current?.abort(), []);

  const mudar = (id) => (e) => {
    setValores((v) => ({ ...v, [id]: e.target.value }));
    setErros((atual) => {
      const resto = { ...atual };
      delete resto[id];
      return resto;
    });
  };

  async function enviar(e) {
    e.preventDefault();
    const { dados, erros: novos } = validar(valores);
    if (novos) { setErros(novos); setEnvio({ status: 'ocioso' }); return; }
    pedido.current?.abort();
    const ctrl = (pedido.current = new AbortController());
    setEnvio({ status: 'enviando' }); // limpa o resultado anterior
    try {
      const resultado = await enviarPrevisao(dados, { signal: ctrl.signal });
      setEnvio({ status: 'sucesso', resultado, enviados: dados });
    } catch (err) {
      if (err?.name !== 'AbortError') setEnvio({ status: 'erro', mensagem: err.message });
    }
  }

  const enviando = envio.status === 'enviando';
  return (
    <form className="card" onSubmit={enviar} noValidate aria-labelledby="t-enviar">
      <h2 id="t-enviar">Enviar dados para a previsão</h2>
      <p className="note">Os 4 dados são enviados ao backend por HTTP (POST). Use vírgula ou ponto para decimais.</p>
      <div className="grid4">
        {CAMPOS.map((c) => (
          <div className="campo" key={c.id}>
            <label htmlFor={`prev-${c.id}`}>{c.rotulo} ({c.unidade})</label>
            <input
              id={`prev-${c.id}`} type="text" inputMode={c.min < 0 ? 'text' : 'decimal'} autoComplete="off"
              placeholder={`${fmtValor(c.min, c.unidade)} a ${fmtValor(c.max, c.unidade)}`}
              value={valores[c.id]} onChange={mudar(c.id)} disabled={enviando}
              aria-invalid={erros[c.id] ? 'true' : undefined} aria-describedby={erros[c.id] ? `prev-${c.id}-erro` : undefined}
            />
            {erros[c.id] && <p className="campo-erro" id={`prev-${c.id}-erro`}>{erros[c.id]}</p>}
          </div>
        ))}
      </div>
      <div className="acoes">
        <button type="submit" className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
        {enviando && <p className="note" role="status">Enviando os dados e aguardando a previsão do modelo…</p>}
        {envio.status === 'erro' && <p className="err" role="alert">Não foi possível enviar: {envio.mensagem}</p>}
      </div>
      {envio.status === 'sucesso' && <ResultadoPrevisao resultado={envio.resultado} legenda="Previsão do modelo para a próxima hora" enviados={envio.enviados} />}
    </form>
  );
}

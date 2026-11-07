# Chuva Londrina — frontend

Painel web de monitoramento de chuva em Londrina (Projeto Integrador I — UTFPR Londrina). Trata **Londrina como um todo** (sem divisão por regiões). Apresenta um mapa de Londrina, indicadores do último registro, gráficos das últimas 24 h, os últimos 7 dias, os últimos eventos de chuva, a maior chuva das últimas 24 h e o histórico do mês.

O frontend foi desenvolvido com React e Vite e **não tem backend**: lê os dados direto do Supabase com `@supabase/supabase-js`. **Todos os dados exibidos vêm do banco**, mesmo que não sejam atuais: a página mostra o último registro disponível e nunca inventa números.

## Pré-requisitos

- Node.js 20.19 ou superior (ou 22.12+); exigência do Vite 8
- npm (instalado junto com o Node.js)
- Acesso ao terminal e à internet durante a instalação das dependências

React e Vite **não precisam ser instalados globalmente**. O `npm ci` instala as versões do projeto, definidas no `package-lock.json`.

## Preparar um computador Windows sem Node.js

1. Baixe o instalador **LTS para Windows** na [página oficial do Node.js](https://nodejs.org/en/download/). Escolha o instalador `.msi` compatível com o computador (normalmente Windows x64).
2. Abra o arquivo baixado e siga o assistente de instalação. Mantenha a opção de instalar o npm e a opção de adicionar o Node.js ao `PATH` habilitadas; as opções padrão do instalador atendem ao projeto.
3. Ao terminar, feche e abra novamente o PowerShell ou o Prompt de Comando. Isso atualiza o `PATH` da janela do terminal.
4. Confirme que Node.js e npm foram instalados:

   ```powershell
   node --version
   npm --version
   ```

   Os comandos devem mostrar os números das versões. O Node.js deve ser 20.19 ou superior. Se aparecer que `node` ou `npm` não é reconhecido, reinicie o terminal; se persistir, peça autorização ao suporte da instituição para instalar o Node.js.
5. Obtenha os arquivos do projeto (por clone do repositório ou arquivo ZIP) e extraia-os, se necessário.
6. No terminal, entre na pasta que contém `package.json` e siga os passos de instalação e execução abaixo.

> Em computadores gerenciados pela faculdade, a instalação de programas pode exigir uma conta de administrador. Nesse caso, solicite ao suporte de TI a instalação do Node.js LTS; não é necessário instalar React ou Vite à parte.

## Instalação e execução

1. Abra o terminal na pasta do projeto que contém o arquivo `package.json`.
2. Instale as dependências:

   ```bash
   npm ci
   ```

3. Inicie o servidor local:

   ```bash
   npm run dev
   ```

4. Abra no navegador o endereço mostrado pelo Vite, normalmente <http://localhost:5173/>.

Sem o `.env` configurado (veja abaixo), a página mostra um aviso de erro: ela só exibe dados do banco.

## Conectar ao Supabase

1. Crie o arquivo `.env` a partir do modelo, na pasta que contém `package.json`:

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux**

   ```bash
   cp .env.example .env
   ```

2. Preencha com os valores do painel do Supabase (**Project Settings → API Keys** / **Data API**):

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=chave-publica
   ```

   Use **somente a chave pública** (`anon`, começa com `eyJ`, ou *publishable*, `sb_publishable_`). **Nunca** use a `service_role` nem a *secret key*: elas ignoram o RLS, e tudo o que está no frontend fica visível no navegador. O `.env` está no `.gitignore` e não deve ser versionado.

3. Reinicie o `npm run dev` depois de alterar o `.env`.

A segurança depende do **RLS** do Supabase: a tabela `dataset_weather_goes` e a view `clima_atual` precisam permitir `SELECT` para o papel `anon`. O frontend só **lê** do Supabase e nunca escreve nele diretamente; a única escrita é o envio dos 4 dados da previsão para a **API do backend** (veja abaixo).

## Conectar ao backend

A tela **Integração** (menu "Integração", rota `/integracao`) conversa com a API HTTP do backend:

- **Enviar dados para a previsão:** o usuário digita os 4 dados (temperatura em °C, umidade relativa em %, pressão ao nível do mar em hPa e nebulosidade em %), que vão em `POST {VITE_API_URL}/previsao` no JSON `{ "temperature_2m", "relative_humidity_2m", "pressure_msl", "cloud_cover" }` (números). O backend devolve a previsão do modelo, e a tela mostra "Vai chover" ou "Não vai chover", a probabilidade em % e os 4 valores enviados. O front **não calcula** a previsão: só exibe o que vem do backend.

  **Formato de resposta (provisório, ainda não confirmado pelo backend):**

  ```json
  { "vai_chover": true, "probabilidade": 0.72 }
  ```

  - `vai_chover`: boolean.
  - `probabilidade`: número. Hoje o front supõe a escala de 0 a 1 (0.72 = 72%). Se o backend mandar de 0 a 100, troque `PROBABILIDADE_ESCALA` para `100`.
  - Os nomes ficam em `RESPOSTA_JSON` e a escala em `PROBABILIDADE_ESCALA`, os dois em `src/services/previsaoApi.js`.
  - Se faltar algum dos campos, ou se a probabilidade ficar fora de 0 a 100%, a tela mostra "Resposta inesperada do servidor".
- **Consultar histórico por data:** `GET {VITE_API_URL}/historico?data=AAAA-MM-DD`, que devolve a previsão registrada para o dia no **mesmo formato provisório** da resposta do POST (`{ "vai_chover": true, "probabilidade": 0.72 }`). A tela mostra "Vai chover" ou "Não vai chover" e a probabilidade. Se vier uma lista, o front usa a primeira previsão (provisório). Quando não há previsão para a data, a resposta é 404 e a tela mostra "Sem previsão registrada".

1. No `.env`, preencha a URL base da API, sem barra no final:

   ```env
   VITE_API_URL=http://localhost:8000
   ```

2. Reinicie o `npm run dev`.

Sem `VITE_API_URL`, o painel funciona normalmente e só a tela Integração mostra o aviso "Backend não configurado". A URL fica visível no navegador, então não coloque nela senha nem chave secreta. O backend precisa liberar o **CORS** para a origem do frontend (ex.: `http://localhost:5173`). Se o site for publicado em HTTPS, a API também precisa estar em HTTPS, senão o navegador bloqueia as chamadas.

Rotas, nomes dos campos do JSON e tempo limite (10 s) ficam todos em `src/services/previsaoApi.js`.

### De onde vem cada dado

As consultas seguem a Seção 1 de `consultas_oficiais.sql` (equipe do banco):

| Bloco da tela | Origem |
|---|---|
| Indicadores: chuva, umidade, temperatura, sensação térmica, vento | **Real** — view `clima_atual` (último registro) |
| Gráficos "Chuva" e "Temperatura" das últimas 24 h | **Real** — 24 registros mais recentes de `dataset_weather_goes` |
| Últimos eventos de chuva | **Real** — 15 registros mais recentes com chuva > 0 |
| Últimos 7 dias (chuva do dia, máx./mín.) | **Real** — registros horários agrupados por dia no frontend (`src/lib/daily.js`) |
| Mapa de Londrina | **Real** — ponto de medição pelas colunas `latitude`/`longitude` do dataset; limite do município do IBGE (código 4113700); fundo do OpenStreetMap |
| Chance histórica de chuva | **Real** — porcentagem de dias do mesmo mês, nos anos anteriores, com chuva ≥ 1 mm (`time` + `precipitation`). **Não é previsão**: a previsão virá da tabela `resultados_previsoes_ia` |
| Vento: descrição e máxima das 24 h | **Real** — escala de Beaufort sobre `wind_speed_10m` e máxima dos últimos 24 registros (o banco não tem direção nem rajada) |
| Histórico do mês | **Real** — chuva acumulada no mês do último registro x média do mesmo mês nos anos anteriores completos (`time` + `precipitation`) |
| Chuva acumulada nas últimas 24 h (ao lado do mapa) | **Real** — soma dos 24 registros mais recentes (consulta 1.2), com o período |
| Maior chuva nas últimas 24 h (indicadores) | **Real** — maior valor de 1 hora nos últimos 24 registros |

Observações sobre os dados:

- "Atual" é o **último registro do banco**, não a hora de agora; a data aparece no topo da página.
- A coluna `time` vem sem fuso e é tratada como horário local de Londrina (função `dbTimeToIso` em `src/lib/format.js`).
- `wind_speed_10m` está em m/s e é convertido para km/h (constante `WIND_TO_KMH` em `src/services/weatherApi.js`).
- Se uma consulta falhar, só o bloco dela mostra o erro. Se todas falharem, a página mostra o aviso "Não foi possível ler o banco" e os blocos ficam vazios — nada de dados inventados.

## Comandos disponíveis

```bash
npm run dev      # inicia o servidor de desenvolvimento
npm run build    # gera a versão de produção em dist/
npm run preview  # serve localmente a versão gerada em dist/
npm run lint     # verifica o código com ESLint (inclui regras de hooks do React)
npm test         # roda os testes (Vitest) com respostas simuladas do banco (src/test/dbFixture.js), sem acessar o Supabase
```

## Organização do código

- `src/App.jsx`: as duas rotas: `/`, o painel (os itens Mapa, Agora, Semana e Dados do menu rolam até a seção, sem mudar o endereço), e `/integracao`.
- `src/components/`: gráficos, chuva acumulada, indicadores, últimos 7 dias e tabelas.
- `src/components/CityMap.jsx`: mapa de Londrina (Leaflet + OpenStreetMap), carregado à parte para não pesar a página. Abre enquadrando o município inteiro.
- `src/data/londrina-ibge.json`: limite oficial do município, baixado da API de malhas do IBGE em **qualidade máxima** (malha municipal 2022, 917 pontos, 18 KB). A versão simplificada se afastava até 1,7 km da divisa real.
- `src/lib/daily.js`: agrupa os registros horários em dias.
- `src/components/ErrorBoundary.jsx`: mostra um aviso em vez de tela em branco se a interface quebrar.
- `src/lib/supabase.js`: instância única do cliente Supabase (ou `null` sem `.env`).
- `src/services/forecastRepo.js`: consultas ao Supabase (Seção 1 do SQL da equipe do banco).
- `src/services/weatherApi.js`: converte as respostas do banco para a tela, valida tudo (`normalize()`), mostra erro por bloco e mantém cache de 5 minutos.
- `src/services/previsaoApi.js`: chamadas HTTP ao backend (`enviarPrevisao`, `buscarHistorico`); todo o contrato da API fica aqui.
- `src/components/PredictionForm.jsx`: formulário com os 4 dados da previsão (validação e envio).
- `src/components/HistoricoBusca.jsx`: busca no backend a previsão registrada para uma data.
- `src/components/ResultadoPrevisao.jsx`: card "Vai chover / Não vai chover" com a probabilidade, usado nos dois quadros.
- `src/lib/camposPrevisao.js`: rótulo, unidade e faixa válida de cada um dos 4 dados.
- `src/test/dbFixture.js`: respostas simuladas do banco, usadas **só nos testes**.
- `src/lib/format.js`: formatação de valores e datas.
- `src/styles.css`: estilos, responsividade e animações da interface.
- `index.html`: documento de entrada do Vite.

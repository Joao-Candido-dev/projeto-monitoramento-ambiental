# Demandas ao Frontend — busca histórica e previsão de chuva

**Projeto:** Chuva Londrina
**Data:** 08/11/2026
**Status:** contrato de referência do Frontend; Backend Etapas 1 e 2 implementadas e testadas no fluxo principal. A integração no navegador ainda depende da adaptação do Frontend.

## Referência desta revisão — v6 definida para a integração

**Decisão definida pela equipe:** a v6 é a versão final de treinamento desta etapa e a base desta integração do MVP histórico. Não é necessário escolher outro treinamento para implementar este fluxo. Isso não significa aprovação para previsão em tempo real ou avaliação futura independente.

O serviço carregará `weather_ensemble.joblib`, produzido por `scripts/package_weather_model.py` no repositório de pesquisa original a partir dos três Random Forests da v6. O pacote combina as probabilidades calibradas dos três modelos com pesos iguais. A versão documentada é `weather-v6-simple-mean-isotonic-v1`. O empacotador atual usa limiar 0,50; a API deve devolver o limiar e a versão do pacote carregado, e o Frontend deve exibi-los sem recalcular a classificação. A avaliação v7 complementa os estudos da v6; não é outro treinamento a ser executado pela interface.

O Backend carrega e verifica o pacote v6 já treinado no início do processo; não executa `train_v6.py` a cada previsão. O pacote e as credenciais são configurações locais do servidor e não devem ser adicionados ao Git ou ao bundle do Frontend.

### Sete features não são sete campos para o usuário

| Feature utilizada pelo modelo | Origem e responsável |
|---|---|
| `temperature_2m` | Banco fornece temperatura em T. |
| `relative_humidity_2m` | Banco fornece umidade em T. |
| `pressure_msl` | Banco fornece pressão em T. |
| `cloud_cover` | Banco fornece cobertura de nuvens em T. |
| `temp_humidity` | Backend calcula temperatura × umidade. |
| `pressure_diff` | Backend calcula pressão em T menos pressão de exatamente T−1h. |
| `hour_of_day` | Backend extrai a hora de T em `America/Sao_Paulo`. |

**Frontend:** recebe a escolha de data/hora e exibe as cinco medidas consultadas; não calcula as features. **Banco:** fornece quatro medidas em T e a pressão de T−1h. Essa pressão vem da coluna `pressure_msl` do registro anterior exato; não exige criar uma coluna de pressão anterior na tabela meteorológica. Na tabela de previsões, salvar as cinco medidas usadas, T e a versão do modelo. Não é obrigatório criar colunas para as três features derivadas nesta entrega. **Backend:** valida horários e valores, prepara as sete features e executa o pacote.

### Regra única de reenvio para as três equipes

1. Ao iniciar uma nova geração intencional, o Frontend cria um UUID e envia no cabeçalho `Idempotency-Key`. Mantém essa chave e o mesmo corpo enquanto o pedido estiver pendente ou com resultado incerto. Não é necessário enviar a chave no JSON.
2. O Backend valida a chave e a registra como `request_id` único na tabela de previsões. Mesma chave e mesmo pedido representam a mesma execução, independentemente de correções posteriores no dataset ou mudança do modelo. Se já houver resultado salvo, devolver esse resultado original, sem recalcular nem criar outra linha.
3. Se a mesma chave vier com outro horário ou modo, devolver **HTTP 409**, com `error.code="IDEMPOTENCY_CONFLICT"`. O Frontend mostra o conflito; não gera outra chave automaticamente para contorná-lo.
4. Se o pedido ainda estiver sendo processado, devolver **HTTP 409**, com `error.code="REQUEST_IN_PROGRESS"`. A tela informa que é preciso aguardar; eventual nova tentativa mantém a mesma chave. O Backend deve controlar pedidos concorrentes; a restrição única do Banco é a proteção final contra gravação duplicada.
5. Primeira gravação confirmada: **HTTP 201**. Reenvio de pedido já concluído: **HTTP 200**, com o mesmo registro e `prediction_id`. O Frontend trata os dois como sucesso e atualiza o histórico sem duplicar visualmente o item.
6. Timeout ou falha de rede não prova que houve falha na gravação. Não repetir automaticamente. Oferecer **Tentar novamente**, reutilizando a chave e o corpo do pedido incerto, ou consultar o histórico. Preservar o pedido pendente durante a sessão, inclusive após recarregar a página. “Nova previsão” é uma ação distinta e gera uma nova chave.
7. O Backend devolve `request_id` no resultado e nos itens do histórico. A chave ausente ou malformada é erro **422**. Uma falha confirmada antes de salvar não cria previsão bem-sucedida e não deve impedir uma tentativa posterior com a mesma chave.

Exemplo do cabeçalho no POST:

```http
Idempotency-Key: 7d55d4c2-9ec1-4a8e-8a15-9ef091a4a408
```

O corpo histórico permanece somente com `mode` e `reference_time`. Toda resposta de sucesso, inclusive no histórico, inclui o `request_id` correspondente. O Backend já implementa o fluxo principal; veja os exemplos atualizados no apêndice desta documentação.

**Referência para este fluxo:** estes três documentos revisados usam busca automática pelo Backend e POST com T/modo. Eles substituem, para esta integração histórica, a proposta antiga de enviar medidas manualmente em `docs/integration/`. Os três contratos antigos foram removidos; estes documentos são a referência vigente da integração. O formulário manual é secundário e não define o contrato principal.

## 1. O que queremos entregar

O usuário deve selecionar uma **data e uma hora**, buscar os dados meteorológicos desse momento e solicitar a previsão de chuva para a próxima hora. Não será necessário digitar temperatura, umidade, pressão ou cobertura de nuvens.

A primeira versão será uma **simulação histórica**, utilizando registros do Supabase. Não representa uma previsão ao vivo nem permite escolher uma data futura arbitrária.

O fluxo terá dois botões:

1. **Buscar dados:** apresenta as entradas disponíveis para o horário escolhido.
2. **Gerar previsão experimental:** solicita a execução do modelo, salva e apresenta o resultado.

## 2. Fluxo da tela

```text
Selecionar data e hora de referência T
                   ↓
              Buscar dados
                   ↓
Frontend → Backend → Supabase
                   ↓
Exibir entradas encontradas, somente para leitura
                   ↓
       Gerar previsão experimental
                   ↓
Backend consulta novamente, valida e executa o modelo
                   ↓
Backend salva a execução e devolve o resultado
                   ↓
Frontend mostra o resultado e atualiza o histórico
```

Exemplo: ao selecionar **01/09/2026 às 14h**, a janela prevista é **das 14h às 15h**, no horário de Londrina.

## 3. Componentes e comportamento esperados

| Elemento | Requisito |
|---|---|
| Título | “Previsão experimental”. |
| Identificação | Mostrar “Simulação histórica” de forma visível. |
| Data | Calendário com limites obtidos do serviço, sem período fixo no código. |
| Hora | Lista de horários disponíveis no dia selecionado. |
| Buscar dados | Habilitar após selecionar data e hora; mostrar carregamento durante a consulta. |
| Dados utilizados | Mostrar as cinco medidas recebidas, com unidades e horários, sem edição. |
| Janela | Mostrar T e T+1h antes e depois da execução. |
| Gerar previsão experimental | Habilitar somente depois de uma busca válida para a seleção atual. Desabilitar enquanto envia. |
| Resultado | Classificação, probabilidade, janela, versão e identificação da previsão. |
| Histórico | Atualizar após sucesso confirmado; permitir consultar execuções anteriores. |

Ao mudar a data ou a hora, limpar os dados e o resultado da seleção anterior, cancelar requisições pendentes quando possível e exigir uma nova busca. Uma resposta atrasada de uma seleção antiga não pode substituir os dados da seleção atual.

O formulário manual existente pode permanecer em uma área secundária de teste. Ele não faz parte do fluxo principal desta entrega.

## 4. Quais dados serão apresentados

O Backend buscará no Supabase:

| Referência | Variáveis | Unidades |
|---|---|---|
| T | Temperatura, umidade relativa, pressão ao nível do mar e cobertura de nuvens | °C, %, hPa e % |
| Exatamente T−1h | Pressão ao nível do mar da hora anterior | hPa |

A pressão anterior é uma nova necessidade do modelo v6 definido para integração. O Frontend apenas a exibe: o Backend calcula a diferença de pressão, o produto temperatura × umidade e a hora do dia, formando os sete atributos do modelo.

Não buscar a chuva em T+1h como entrada. Ela é a resposta futura que queremos estimar. Se faltar alguma medida obrigatória, o serviço deve informar a indisponibilidade, sem substituir por dados de outro horário.

## 5. Contratos HTTP propostos

Centralizar as chamadas em `src/services/previsaoApi.js`, usando `VITE_API_URL`. O fluxo novo usa `/predict`; o frontend atual usa `/previsao`. As equipes precisam adotar um único contrato antes da integração real.

Todos os exemplos a seguir são **fictícios para desenvolvimento**. Os timestamps devem conter fuso; apresentar as datas em `America/Sao_Paulo`. Não usar o fuso do computador do usuário como referência implícita. Na URL, usar `URLSearchParams` para codificar os parâmetros.

### 5.1 Obter o período disponível

**Proposta:** `GET /available-times`

```json
{
  "min_date": "2020-01-01",
  "max_date": "2026-09-30",
  "timezone": "America/Sao_Paulo"
}
```

Datas ilustrativas; não devem virar constantes no componente. Se não houver dados elegíveis, o serviço poderá retornar ambas como `null`; a tela mostra “Nenhum horário disponível”. O intervalo não garante que todos os dias tenham registros.

### 5.2 Listar horários de um dia

**Proposta:** `GET /available-times?date=2026-09-01`

```json
{
  "date": "2026-09-01",
  "timezone": "America/Sao_Paulo",
  "times": [
    "2026-09-01T14:00:00-03:00",
    "2026-09-01T15:00:00-03:00"
  ]
}
```

Somente horários elegíveis, com as medidas de T e pressão de T−1h, devem ser oferecidos. Dia sem horários: HTTP 200 com `times: []`. O Backend valida novamente nas etapas seguintes.

### 5.3 Buscar as entradas

**Proposta:** `GET /weather-inputs?reference_time=<timestamp codificado>`

Resposta HTTP 200:

```json
{
  "location": "Londrina-PR",
  "mode": "historical",
  "reference_time": "2026-09-01T14:00:00-03:00",
  "previous_reference_time": "2026-09-01T13:00:00-03:00",
  "forecast_start": "2026-09-01T14:00:00-03:00",
  "forecast_end": "2026-09-01T15:00:00-03:00",
  "weather": {
    "temperature_2m": 24.7,
    "relative_humidity_2m": 74,
    "pressure_msl": 1008.9,
    "cloud_cover": 97,
    "pressure_msl_previous_hour": 1009.4
  }
}
```

Essa consulta apenas apresenta as entradas. Não executa o modelo nem cria uma previsão no histórico.

### 5.4 Gerar e salvar a previsão

**Proposta:** `POST /predict`, com `Content-Type: application/json`.

```json
{
  "mode": "historical",
  "reference_time": "2026-09-01T14:00:00-03:00"
}
```

No corpo, o Frontend envia apenas o horário e o modo; no cabeçalho envia `Idempotency-Key`. O Backend consulta novamente o banco, valida, prepara os atributos, executa o modelo já treinado e salva a execução. Não há treinamento a cada clique.

Resposta: **HTTP 201 na primeira gravação confirmada; HTTP 200 no reenvio de pedido já concluído**, com o mesmo registro salvo. Exemplo de fixture fictícia para o Frontend:

```json
{
  "prediction_id": "550e8400-e29b-41d4-a716-446655440000",
  "request_id": "7d55d4c2-9ec1-4a8e-8a15-9ef091a4a408",
  "created_at": "2026-11-07T15:00:00Z",
  "location": "Londrina-PR",
  "mode": "historical",
  "is_mock": true,
  "model_version": null,
  "reference_time": "2026-09-01T14:00:00-03:00",
  "previous_reference_time": "2026-09-01T13:00:00-03:00",
  "forecast_start": "2026-09-01T14:00:00-03:00",
  "forecast_end": "2026-09-01T15:00:00-03:00",
  "horizon_hours": 1,
  "weather": {
    "temperature_2m": 24.7,
    "relative_humidity_2m": 74,
    "pressure_msl": 1008.9,
    "cloud_cover": 97,
    "pressure_msl_previous_hour": 1009.4
  },
  "rain_probability": 0.72,
  "rain_predicted": true,
  "decision_threshold": 0.5
}
```

No serviço com modelo real, `is_mock=false` e `model_version` identifica a versão efetivamente carregada. A versão definida para esta integração é `weather-v6-simple-mean-isotonic-v1`.

O resultado deve exibir as entradas **devolvidas pelo POST**, pois são as efetivamente utilizadas. Se elas diferirem das apresentadas na busca anterior, avisar que o registro foi atualizado entre a consulta e a execução.

### 5.5 Erros

Envelope proposto:

```json
{
  "error": {
    "code": "MISSING_PREVIOUS_HOUR",
    "message": "Não é possível gerar a previsão: falta a pressão da hora anterior.",
    "field": "reference_time"
  }
}
```

| Situação | Resposta proposta | Comportamento da tela |
|---|---|---|
| Dia sem horários | 200 e lista vazia | Mostrar ausência de dados e desabilitar a busca. |
| Registro de T inexistente | 404 | Informar que o registro não está disponível. |
| Formato inválido ou dados obrigatórios inválidos/ausentes | 422 | Mostrar mensagem legível; não apresentar previsão. |
| Modelo, banco ou gravação indisponível | 503 | Informar indisponibilidade, sem inventar resultado. |
| Pedido concluído reenviado com a mesma chave | 200 e registro original | Exibir sucesso, sem duplicar o item no histórico. |
| Chave reutilizada com outro pedido | 409, `IDEMPOTENCY_CONFLICT` | Mostrar conflito; não trocar a chave automaticamente. |
| Pedido ainda em processamento | 409, `REQUEST_IN_PROGRESS` | Pedir para aguardar; manter chave e corpo. |
| Falha de rede/timeout | Sem resposta confirmada | Informar falha; não repetir POST automaticamente. |

Adaptar o cliente para ler `error.message`. Não interpretar lista vazia ou erro como “sem chuva”. Após timeout do POST, a gravação pode ter ocorrido: o usuário deve poder consultar o histórico antes de reenviar. Aplicar a regra de reenvio definida no início deste documento: manter a mesma chave para o mesmo pedido incerto.

## 6. Exibição do resultado e histórico

Usar **Chuva prevista** ou **Sem chuva prevista**, conforme `rain_predicted`. Exibir `rain_probability × 100` como **probabilidade estimada**, não como acurácia. O Frontend não escolhe o limiar nem recalcula a classe.

Mostrar janela, entradas, ID e versão. Com `is_mock=true`, exibir “Resultado fictício para desenvolvimento”; fixtures não devem entrar no histórico real.

No histórico, separar:

- **Gerada em:** `created_at`, instante em que a aplicação executou a previsão.
- **Referência:** `reference_time`, horário histórico escolhido.
- **Período previsto:** `forecast_start` até `forecast_end`.

Uma simulação de setembro executada hoje aparece nas execuções de hoje. O recorte inicial de sete dias deve usar `created_at`. Não limitar esse filtro às datas do dataset. Várias previsões do mesmo T podem existir e devem ser mostradas separadamente.

Proposta de consulta: `GET /predictions?created_from=<timestamp>&created_to=<timestamp>&limit=20&cursor=<cursor>`. Intervalo inicial inclusivo e final exclusivo; resposta com `items` e `next_cursor`. Cada item segue o formato do POST; vazio é `{"items":[],"next_cursor":null}`. Ordenação: execução mais recente primeiro, com ID como desempate. Não usar apenas o primeiro item da lista, como faz a busca atual.

## 7. Arquivos do Frontend envolvidos

| Arquivo atual | Alteração esperada |
|---|---|
| `src/components/PredictionForm.jsx` | Evoluir o fluxo principal para data/hora, busca e geração; preservar teste manual separadamente se desejado. |
| `src/services/previsaoApi.js` | Implementar disponibilidade, busca de entradas, novo POST e listagem; preservar os metadados das respostas. |
| `src/components/ResultadoPrevisao.jsx` | Mostrar janela, modo, ID, versão e dados usados; ajustar o texto da classificação. |
| `src/components/HistoricoBusca.jsx` | Consultar várias execuções, remover datas fixas e distinguir execução de referência. |
| `src/lib/camposPrevisao.js` | Reaproveitar rótulos e unidades; acrescentar pressão anterior para exibição. |
| `src/App.jsx` e `Panels.jsx` | Ajustar navegação e reservar a área de histórico de previsões, preservando o resumo diário na EDA. |

As consultas de EDA ao Supabase podem continuar no fluxo atual. A busca de entradas para inferência e a gravação das previsões serão responsabilidade do Backend.

## 8. Trabalho em paralelo e responsabilidades

**Frontend:** desenvolver seletores, estados, quadro de entradas, resultado e histórico. Criar fixtures de sucesso, vazio, ausência da pressão anterior e indisponibilidade. Centralizar o serviço simulado para trocar pela API real sem reescrever os componentes.

**Backend:** implementar as rotas acordadas; consultar T e exatamente T−1h; validar dados; carregar o pacote do modelo; calcular os sete atributos; executar e persistir; devolver as entradas e resultados usados.

**Banco de Dados:** confirmar tabela e colunas meteorológicas, unidades, fuso e unicidade por local/horário; disponibilizar acesso ao Backend e tabela de previsões com os campos necessários.

Antes da conexão real, fechar nomes das rotas, formato JSON, erros, URL e origem permitida no navegador. Acordar também autorização e implementar o tratamento de pedidos repetidos definido nesta revisão. A escolha automática dos dados não depende de incorporar imagens GOES nesta entrega.

## 9. Checklist de aceite

- [ ] O calendário e a lista de horas usam disponibilidade retornada pelo serviço.
- [ ] A busca mostra quatro medidas em T e a pressão em T−1h, com unidades.
- [ ] Mudar a seleção invalida os dados e o resultado anteriores.
- [ ] Sem entradas válidas, o botão de previsão permanece desabilitado.
- [ ] A geração envia apenas T e modo; a resposta traz as entradas efetivamente utilizadas.
- [ ] O resultado mostra classificação, probabilidade, janela e identificação corretamente.
- [ ] Simulação histórica e resultado fictício são identificados quando aplicáveis.
- [ ] Erros, ausência de dados e timeout não são apresentados como previsão.
- [ ] A execução confirmada aparece no histórico, inclusive após recarregar a página.
- [ ] Data de execução e data histórica não são confundidas.

**Limite da entrega:** simulações históricas demonstram o funcionamento do sistema; exemplos escolhidos na tela, inclusive de períodos de treino, não constituem avaliação independente do modelo. A modalidade “Prever agora” dependerá de uma fonte operacional e validação próprias.

### Conferência adicional da revisão v6

- [ ] Não calcular features no Frontend; mostrar as cinco medidas devolvidas.
- [ ] Enviar `Idempotency-Key`, preservar pedidos incertos e tratar 200/201/409.
- [ ] Manter `request_id` e `prediction_id` da resposta, sem duplicar o histórico.


## Localização nesta aplicação

O adaptador fica em `backend/src/models/weather_ensemble.py`. Treinamento, empacotamento e estudos permanecem no repositório de pesquisa; não são executados pelo servidor. O README da raiz informa o que já funciona. As rotas de previsão deste contrato ainda precisam ser implementadas.


## 10. Estado atual e execução para integração

### Configurar e iniciar

Na pasta `frontend`, configure `.env` com a URL local do Backend, sem barra final:

```env
VITE_API_URL=http://localhost:5000
```

Use a porta real em que o Flask estiver executando. Mantenha as configurações Supabase já usadas pela EDA no arquivo local do Frontend. **Não copie `SUPABASE_SERVICE_ROLE_KEY` para o Frontend.**

Em terminais separados, na raiz do repositório:

```powershell
cd backend
.\.venv\Scripts\python.exe -m flask --app app.main run --host 127.0.0.1 --port 5000
```

```powershell
cd frontend
npm run dev -- --host 127.0.0.1
```

O Backend permite CORS somente para a origem definida em `FRONTEND_ORIGIN` (padrão `http://localhost:5173`). Se o Vite usar outra porta, ajustar essa variável no ambiente local do Backend e reiniciar o servidor. O Vite precisa ser reiniciado após mudar `VITE_API_URL`.

### Exemplos conforme o Backend implementado

Buscar medidas (timestamp deve estar codificado pela biblioteca HTTP):

```http
GET /weather-inputs?reference_time=2026-09-01T14%3A00%3A00-03%3A00
```

Resposta 200 inclui `location`, `mode`, `reference_time`, `previous_reference_time`, `forecast_start`, `forecast_end` e `weather` com as cinco medidas: quatro em T e `pressure_msl_previous_hour` em T−1h. T inexistente retorna 404; ausência de T−1h ou entrada inválida retorna 422; banco/modelo indisponível retorna 503.

Criar previsão:

```http
POST /predict
Content-Type: application/json
Idempotency-Key: 7d55d4c2-9ec1-4a8e-8a15-9ef091a4a408

{
  "mode": "historical",
  "reference_time": "2026-09-01T14:00:00-03:00"
}
```

Primeiro salvamento retorna 201 e `prediction_id`; repetição concluída, com a mesma chave/corpo, retorna 200 e o mesmo registro. A mesma chave com outro horário ou modo retorna 409 `IDEMPOTENCY_CONFLICT`. O resultado inclui as entradas usadas, probabilidade de 0 a 1, classificação, limiar, versão, `request_id` e `prediction_id`.

Histórico paginado:

```http
GET /predictions?created_from=2026-11-01T00%3A00%3A00Z&created_to=2026-11-09T00%3A00%3A00Z&limit=20
```

Use `next_cursor` da resposta como parâmetro `cursor` da próxima chamada. Intervalo é inclusivo no início e exclusivo no fim; limite aceito de 1 a 100. O Backend ordena por execução mais recente. Timestamp inválido/cursor inválido retorna 422; indisponibilidade do banco retorna 503.

### Idempotência na tela

- Gere um UUID novo quando o usuário inicia uma previsão intencional.
- Preserve a mesma chave e o mesmo corpo durante envio e em caso de timeout ou resposta incerta; não faça retry automático.
- Trate 201 e 200 como sucesso e atualize a lista sem duplicar visualmente o registro.
- Após sucesso, uma nova previsão intencional, mesmo para o mesmo T, recebe UUID novo.
- O banco não mantém estado `processing`: se duas solicitações iguais coincidirem antes do insert, a restrição UNIQUE evita duplicidade e o pedido concorrente recupera o resultado depois que a primeira gravação conclui. Não espere `REQUEST_IN_PROGRESS` no estado atual.

### Estado já verificado

Em 08/11/2026 o Backend carregou a v6, consultou entradas reais de T/T−1h (200), gravou uma previsão de teste (201), recuperou a mesma linha no reenvio (200), retornou 409 para chave reutilizada com outro horário e consultou o histórico (200). Os 15 testes locais do Backend passaram e o preflight CORS local foi aprovado. O teste real criou um registro persistente no Supabase.

Ainda falta a validação conjunta no navegador com o Frontend adaptado. Falhas de escrita, corrida concorrente durante cálculo e navegação por mais de uma página ainda precisam de testes dedicados.

### Checklist de integração no navegador

- [ ] `VITE_API_URL` aponta para a URL/porta correta do Backend; segredos de serviço não estão no Frontend.
- [ ] Backend responde em `/health` com modelo carregado; Vite usa a origem liberada em `FRONTEND_ORIGIN`.
- [ ] Preflight OPTIONS permite somente a origem esperada e os cabeçalhos `Content-Type` e `Idempotency-Key`.
- [ ] Buscar um horário conhecido apresenta quatro medidas em T e a pressão de exatamente T−1h.
- [ ] Gerar previsão mostra a resposta do Backend e a linha correspondente existe no histórico do Supabase.
- [ ] Reenvio da mesma chave/corpo não cria outra linha; novo pedido intencional usa chave nova.
- [ ] Chave conflitante, falta de dados, timeout e serviço indisponível aparecem como erro, nunca como “sem chuva”.
- [ ] Histórico pagina usando `next_cursor` e distingue `created_at` de `reference_time`.
- [ ] Atualizar a página mantém o histórico salvo e não duplica itens na interface.

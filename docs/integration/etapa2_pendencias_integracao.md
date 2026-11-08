# Pendências para concluir a integração do Backend

**Estado:** Backend adiantou a preparação enquanto a equipe de Frontend ainda não entregou a adaptação do fluxo. Etapas 1 e 2 estão parcialmente implementadas; os testes locais cobrem componentes, mas a integração real com Supabase e Frontend ainda precisa ser validada.

Este roteiro deve ser seguido na ordem. Não há treino a executar: o serviço usa o pacote v6 já treinado. A migração SQL abaixo é proposta para a equipe de Banco revisar e aplicar.

## 1. Banco revisa e aplica a migração

1. Abrir `backend/sql/20261108_secure_prediction_access.sql`.
2. Conferir se há linhas com `request_id` nulo. O script falha de propósito se encontrar alguma; a equipe deve avaliar os registros antes de prosseguir.
3. Executar o script no SQL Editor do projeto Supabase.
4. Confirmar que `request_id` agora é `NOT NULL` e continua `UNIQUE`.
5. Confirmar que `anon` e `authenticated` não conseguem ler `resultados_previsoes_ia`, e que `service_role` consegue consultar e inserir.
6. Confirmar que o Frontend consultará o histórico pela API do Backend.

O Backend não executa migrações por conta própria nem altera tabelas em runtime.

## 2. Configuração local do Backend

1. Copiar `backend/.env.example` para `backend/.env`.
2. Preencher `MODEL_PATH` e `MODEL_MANIFEST_PATH` com os caminhos locais do pacote v6 validado.
3. Preencher `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` com credenciais fornecidas por canal seguro pela equipe do Banco. A chave privilegiada fica somente no ambiente do servidor. Nunca copiar para `frontend/.env`, GitHub, issues ou mensagens.
4. Definir `FRONTEND_ORIGIN` para a origem local do Vite e depois para a origem do ambiente publicado.
5. Instalar dependências a partir de `backend/requirements-lock.txt` e iniciar Flask a partir dessa pasta.
6. Consultar `/health`: esperar `model_loaded=true` e banco configurado. Essa resposta indica configuração, não substitui um teste de gravação.

## 3. Testes do Backend antes da tela

1. Executar toda a suíte de `backend/tests` com o ambiente virtual do backend.
2. Validar `/weather-inputs` com horário existente, hora sem dados, falta de T−1h, medidas nulas e formato sem fuso.
3. Com uma chave UUID nova, enviar `POST /predict` com `{"mode":"historical","reference_time":"..."}` e cabeçalho `Idempotency-Key`.
4. Confirmar HTTP 201 somente depois de uma linha aparecer em `resultados_previsoes_ia`.
5. Reenviar a mesma chave e corpo: esperar HTTP 200 e o mesmo `prediction_id`.
6. Reutilizar a chave com outro horário: esperar 409 `IDEMPOTENCY_CONFLICT`.
7. Simular gravação indisponível: esperar 503 sem sucesso falso.
8. Consultar `/predictions` em duas páginas, conferir ordenação por `created_at` e `prediction_id`, intervalo final exclusivo e cursor.
9. Fazer pedidos concorrentes com a mesma chave: esperar uma linha única; a chamada que encontra a restrição UNIQUE recupera a linha original. A tabela não tem estado `processing`, portanto o backend não consegue responder `REQUEST_IN_PROGRESS` durante o cálculo.

Executar esses testes reais apenas depois da migração e configuração segura. Os testes unitários devem usar repositórios simulados; não inserir fixtures no histórico real.

## 4. Trabalho da equipe de Frontend

Enquanto isso, a equipe pode adaptar `frontend/src/services/previsaoApi.js` e os componentes da tela para:

1. Escolher horário histórico T e buscar entradas via `GET /weather-inputs`.
2. Exibir as cinco medidas devolvidas, sem calcular features no navegador.
3. Gerar UUID por solicitação intencional, enviar `Idempotency-Key` e preservar chave/corpo após timeout.
4. Enviar somente `mode` e `reference_time` no POST; tratar 201, 200, 409, 422 e 503.
5. Consultar o histórico paginado em `GET /predictions`, mostrando data de execução separada da data histórica.
6. Configurar `VITE_API_URL` com a URL do Backend. Nunca colocar `service_role` no Frontend.

O formulário atual do Frontend ainda usa o contrato antigo e precisa ser adaptado. A equipe pode desenvolver com fixtures claramente fictícias até a API estar disponível.

## 5. Teste conjunto e aceite

1. Iniciar o Backend e o Frontend localmente; confirmar preflight CORS para a origem permitida e rejeição de origens não configuradas.
2. Selecionar um horário conhecido, buscar dados e conferir T/T−1h.
3. Gerar previsão, confirmar resultado na tela e uma única linha no Supabase com os mesmos valores.
4. Reenviar a mesma chave: verificar o mesmo registro sem linha duplicada.
5. Atualizar a página e confirmar que a previsão aparece no histórico paginado.
6. Testar falta de dados, indisponibilidade, conflito de chave e erro de gravação; nenhuma falha deve aparecer como “sem chuva”.

## Resultado consolidado da Etapa 2 — 08/11/2026

### Implementado

- `POST /predict`: valida `Idempotency-Key` UUID e corpo histórico, consulta T/T−1h, executa o pacote v6 e grava uma linha em `resultados_previsoes_ia`; responde 201 após a gravação.
- Reenvio com a mesma chave e mesmos dados recupera a previsão existente e responde 200. Chave com outro horário/modo retorna 409 `IDEMPOTENCY_CONFLICT`.
- `GET /predictions`: intervalo temporal, limite de 1 a 100, ordenação decrescente e cursor para paginação.
- CORS limitado à origem `FRONTEND_ORIGIN`; leitura de configurações locais pelo `.env` do Backend.
- Migração versionada em `backend/sql/20261108_secure_prediction_access.sql` para `request_id NOT NULL` e retirada do SELECT público. Aplicação foi confirmada pela equipe do Banco; não foi executada pelo Backend.
- Guia de execução nesta documentação. Credenciais e modelo permanecem fora do Git.

### Verificações executadas

- 15 testes locais do Backend aprovados.
- `/health`, carregamento do modelo e `/weather-inputs`: HTTP 200.
- Preflight CORS da origem local: HTTP 200.
- Previsão real: HTTP 201 e linha persistida. `prediction_id`: `c1b87cbf-6699-44f6-93f1-30e6d38d69c9`; `request_id`: `16f6a007-225f-4ab7-ac38-0ffe81690fd1`.
- Reenvio da mesma chave: HTTP 200, mesmo `prediction_id`. A comparação foi corrigida para considerar o instante, pois o banco normaliza o timestamp em UTC.
- Mesma chave com outro horário: HTTP 409 `IDEMPOTENCY_CONFLICT`.
- Histórico: HTTP 200 com o registro persistido.

### Limites e próximos passos

- O teste de concorrência durante o cálculo, falha de escrita e paginação com múltiplas páginas ainda não foi realizado.
- O esquema não guarda estado `processing`; colisões são evitadas pela unicidade e o pedido repetido recupera a linha depois da primeira gravação. Não é possível retornar `REQUEST_IN_PROGRESS` durante o cálculo.
- A equipe Frontend ainda precisa adaptar a tela para os contratos e testar no navegador com o backend.
- A previsão persistida acima é um registro de teste histórico e permanece no Supabase.
- O Backend não alterou dados/tabelas diretamente; a migração foi aplicada pela equipe responsável.

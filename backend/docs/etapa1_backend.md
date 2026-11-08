# Integração do backend

## Etapa 1

O backend verifica manifesto/hash e carrega uma vez o pacote v6; consulta T e T−1h em `/weather-inputs`; calcula a previsão com o adaptador v6. Erros seguem 404/422/503.

## Etapa 2

- `POST /predict`: JSON `{"mode":"historical","reference_time":"2026-09-01T14:00:00-03:00"}` e UUID no cabeçalho `Idempotency-Key`. Primeira gravação confirmada retorna 201. Reenvio da mesma chave e pedido retorna a linha existente em 200. Reuso da chave com outro horário/modo retorna 409 `IDEMPOTENCY_CONFLICT`. Erros de banco/gravação retornam 503; entrada inválida 422.
- `GET /predictions?created_from=...&created_to=...&limit=20&cursor=...`: timestamps com fuso, intervalo inicial inclusivo/final exclusivo, 1–100 linhas, ordenação de criação decrescente e cursor opaco.
- CORS permite somente a origem configurada em `FRONTEND_ORIGIN`.

A API grava `resultados_previsoes_ia` por PostgREST usando `SUPABASE_SERVICE_ROLE_KEY`, segredo restrito ao servidor. `backend/.env` é local e ignorado pelo Git. Não usar a chave no Frontend. As rotas de escrita dependem da aplicação da migração em `backend/sql/20261108_secure_prediction_access.sql` pela equipe do Banco.

## Diferenças e pendências comunicadas ao Banco

1. O SQL entregue declara `request_id UUID UNIQUE`, mas permite NULL. A migração propõe `NOT NULL` e interrompe se já houver linha sem chave.
2. A política entregue permite SELECT público via `anon`; a migração remove essa leitura e mantém consulta/gravação para `service_role`. A equipe do Banco deve revisar e aplicar a migração, não a API.
3. O esquema não possui estado `processing`. Em colisão simultânea, a restrição UNIQUE impede segunda gravação; após a primeira confirmar, a segunda recupera a linha e retorna 200. O backend não retorna `REQUEST_IN_PROGRESS` nesse intervalo, pois a tabela não registra esse estado.
4. A inserção salva entradas e resultado em uma única linha. Não executamos mudanças no Supabase nesta etapa.
5. A chave privilegiada anteriormente compartilhada deve ser rotacionada. O código lê a nova chave do ambiente, mas não gravamos credenciais em arquivos.
6. A gravação/histórico real só podem ser validados depois que a equipe aplicar a migração e a nova chave for configurada localmente.

# Monitoramento ambiental — Londrina

Aplicação das equipes de Backend, Frontend e Banco de Dados. Nesta etapa organizamos a execução local e preparamos a integração de **simulação histórica de chuva na próxima hora**, com a **v6 definida como modelo desta integração**.

## O que funciona e o que falta

- Frontend React/Vite: painel meteorológico e componentes existentes, com leitura do Supabase quando configurado.
- Backend Flask: servidor executável com `GET /health` e adaptador das sete features da v6.
- Ainda falta: carregar/verificar o modelo, consultar T e T−1h no banco, implementar previsão/persistência/histórico e adaptar a tela para busca por data/hora.
- O formulário atual do frontend ainda usa `/previsao` e `/historico` com o contrato anterior. Essas rotas **não estão implementadas neste backend**. A referência para a adaptação é [o alinhamento das equipes](docs/integration/alinhamento_tres_equipes_integracao.md).
- `/health` indica que o servidor responde; `integration_ready: false` deixa claro que não significa integração concluída.

## Estrutura

```text
backend/
  app/main.py                 # Servidor e /health
  src/models/weather_ensemble.py  # Adaptador v6 preservado
  config.py                   # Fuso usado pelo adaptador
  tests/                      # Testes de saúde e features
  requirements.txt
  .env.example
frontend/
  src/components/             # Tela e componentes existentes
  src/services/               # Consultas ao banco e chamadas HTTP
  src/lib/                    # Funções compartilhadas
  package.json
  package-lock.json
  .env.example
docs/
  integration/                # Três documentos vigentes das equipes
  originals/                  # READMEs originais preservados, não instruções atuais
  continuidade.md             # Pendências e origem dos arquivos
scripts/check_staged.py        # Proteção contra dados/modelos no commit
```

## 1. Clonar e preparar o Git

```powershell
git clone https://github.com/victorhukra/projeto-monitoramento-ambiental.git
cd projeto-monitoramento-ambiental
git config core.hooksPath .githooks
```

O hook precisa de Python no PATH e é configurado em cada clone. Ele verifica o índice antes dos commits. `.gitignore` e o hook bloqueiam datasets, modelos, ambientes, credenciais por nome e arquivos acima de 1 MB. Eles não substituem a revisão do conteúdo: nunca inserir segredos no código. Não usar `git add -f` para contornar as regras.

## 2. Executar o backend

Use Python 3.14 para reproduzir o ambiente local verificado. O ambiente do **modelo real** ainda deve ser comparado com seu manifesto antes de carregar o artefato; não foi validado nesta etapa.

Na raiz do projeto:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m flask --app app.main run --host 127.0.0.1 --port 8000
```

Em outro terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

O servidor de desenvolvimento é para uso local. Não é uma configuração de produção. Para parar: Ctrl+C.

O backend atual não precisa de banco, dataset ou modelo para iniciar. `backend/.env.example` é uma referência das configurações previstas; **não há carregamento automático de `.env`**. As variáveis para banco/modelo só serão consumidas ao implementar esses serviços.

## 3. Executar o frontend

Use o Node.js compatível com o lockfile; a validação local desta migração usa Node 26.13.0 e npm 11.20.0.

Abra outro terminal na raiz:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev -- --host 127.0.0.1
```

Abra `http://127.0.0.1:5173/`. A rota de integração fica em `/integracao`. O caminho antigo de publicação `/Frontend-ProjetoIntegrador/` foi removido.

No `frontend/.env`, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a **chave pública**. As consultas de leitura dependem das permissões RLS do banco. Sem configuração, a tela informa a indisponibilidade: não inventa dados. Nunca colocar `service_role` ou outra chave secreta no frontend.

`VITE_API_URL=http://127.0.0.1:8000` será usada na integração, mas configurar a URL não implementa as rotas que faltam. Reinicie o Vite ao alterar `.env`.

Verificações:

```powershell
npm test
npm run lint
npm run build
```

## Modelo, dados e integração

Não copiar os 73 GB para o repositório. Esta aplicação não precisa das imagens GOES. Também não treina a cada pedido.

O responsável pelo treinamento deve fornecer por canal separado `weather_ensemble.joblib` e o manifesto correspondente, com versão, hash e ambiente. Guarde-os fora do repositório, por exemplo `C:/dados-monitoramento/modelo-v6/`. Não carregar artefatos de origem desconhecida. O adaptador mantém o caminho Python `src.models.weather_ensemble` e a configuração `config.WEATHER_TIMEZONE` para compatibilidade com o pacote existente; executar o backend a partir de `backend/`.

A v6 usa temperatura, umidade, pressão e nuvens em T, além da pressão de **exatamente T−1h**. O backend calcula temperatura × umidade, diferença de pressão e hora local. O usuário escolherá data/hora, não sete features.

Contratos vigentes:

- [Alinhamento das três equipes](docs/integration/alinhamento_tres_equipes_integracao.md)
- [Demandas do Frontend](docs/integration/demandas_frontend_busca_e_previsao.md)
- [Demandas do Banco](docs/integration/demandas_banco_busca_e_previsao.md)

Eles descrevem o que implementar, não rotas já disponíveis. Reenvios mantêm `Idempotency-Key`; primeira gravação retorna 201, repetição concluída retorna 200 e conflitos retornam 409 conforme os documentos.

## Trabalho em equipe

`main` guarda a base revisada. Criar `feature/nome-da-tarefa`, fazer commits pequenos e abrir pull request. Antes de juntar, executar os testes da parte alterada e revisar o diff. Não subir ambientes, segredos, dados ou modelos.

Os READMEs anteriores foram preservados integralmente em [docs/originals](docs/originals/). Seus caminhos/comandos descrevem os repositórios antigos. Para este repositório, use este README e [o roteiro de continuidade](docs/continuidade.md).

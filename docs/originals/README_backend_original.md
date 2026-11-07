# Previsão de chuva em Londrina

Nosso objetivo é construir um MVP que receba dados meteorológicos e estime **se vai chover na próxima hora**. A equipe quer integrar dados → modelo → API → banco → tela, com código simples e compreensível.

## Onde estamos

- Auditoria e análise exploratória dos dados concluídas.
- Tabela experimental preparada: **59.159 registros**, com temperatura, umidade, pressão e nebulosidade como entradas.
- Seis ciclos de treinamento documentados. A v6 compara três Random Forests e combinações; a avaliação v7 usa protocolo temporal aninhado para calibrar probabilidades, ajustar pesos e limiares.
- O período de 2026 ficou fora da seleção v5. Ele já havia sido consultado em ciclos anteriores e não representa uma avaliação independente.
- Versão v6 definida para esta integração: média simples dos três Random Forests v6, calibradores isotônicos, limiar inicial 0,50 e pacote do modelo e manifesto locais. Contratos da interface, da retaguarda e do banco atualizados; API, banco e tela ainda não estão implementados.

O Random Forest balanceado identifica mais eventos de chuva e também gera mais alarmes falsos. Ainda não há modelo escolhido para operação nem serviço de previsão em tempo real. As imagens GOES ficam para uma evolução futura; você não precisa baixar o acervo para trabalhar no MVP meteorológico atual.

**Limitação importante:** adotamos a hipótese de que a chuva registrada em T+1h representa a hora seguinte a T. Essa interpretação e a disponibilidade dos dados no instante da previsão ainda precisam de confirmação na origem. Por enquanto, o estudo é histórico e experimental.

## 1. Preparar o ambiente

Você precisa de **Git, Python 3.13 e acesso ao repositório privado**. O pacote candidato foi gerado com Python 3.13.3 e as versões fixadas em `requirements.txt`; para reproduzir o ambiente registrado no manifesto, use essas mesmas versões. No terminal PowerShell:

```powershell
git clone https://github.com/victorhukra/backend-monitoramento-ambiental.git
cd backend-monitoramento-ambiental
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
git config core.hooksPath .githooks
Copy-Item .env.example .env
```

Se já tem o projeto, use sua pasta existente. Copie `.env.example` somente se ainda não tiver `.env`, para preservar seus caminhos locais.

No Linux/macOS, use `python3.13 -m venv .venv`, `source .venv/bin/activate` e `cp .env.example .env`. Os comandos Python seguintes são iguais.

As dependências fixadas em `requirements.txt` incluem pandas, NumPy, Matplotlib, scikit-learn e joblib. Os ambientes local e de validação estão com dependências consistentes (`pip check` sem conflitos); a equipe deve repetir a instalação limpa no computador de destino.

## 2. Indicar onde está o CSV

Solicite à equipe o arquivo `dataset_weather.csv`: ele **não vem no GitHub**. Guarde-o fora do repositório, por exemplo em `D:/dados-goes/`, e ajuste estas linhas no seu `.env`:

```dotenv
WEATHER_CSV_PATH=D:/dados-goes/dataset_weather.csv
WEATHER_TRAINING_PATH=data/processed/weather_training.csv
```

Substitua o caminho pelo da sua máquina. Caminhos relativos partem da raiz do projeto. As opções GOES do `.env` podem ficar como estão para esta etapa.

## 3. Preparar a tabela

Na raiz do projeto, com o ambiente ativo:

```powershell
python -B scripts/prepare_weather.py --plot
```

O script lê o CSV original, associa cada horário à chuva de **exatamente uma hora depois** e grava os resultados em `data/processed/`:

| Arquivo | Para que serve |
|---|---|
| `weather_training.csv` | Quatro entradas, horário de referência, horário do alvo e classe de chuva |
| `weather_training.json` | Contagens, parâmetros e identificação da fonte |
| `weather_training_excluded.csv` | Linhas que não puderam entrar e seus motivos |
| `weather_training_preview.csv` | Dez primeiras linhas para conferência |
| `weather_training.png` | Gráfico das quantidades com e sem chuva |

O original permanece intacto. O script não divide períodos nem treina um modelo. Sem `--plot`, não gera o gráfico.

**Se a tabela já existe, não é necessário gerá-la novamente.** O script evita sobrescritas; para uma nova versão, use `--output data/processed/weather_training_v2.csv`.

Entenda cada passo em [Preparação da tabela](docs/prepare_weather.md). A preparação não treina modelos; ela só constrói e documenta a tabela de exemplos.

## 4. Treinar e comparar os modelos

O fluxo mais recente está no script v6; a v5 permanece documentada para comparação. A v4 e o avaliador histórico foram arquivados em `scripts/archive/`; `scripts/evaluate_test.py` é o ponto de entrada atual de avaliação. Com a tabela disponível e o ambiente ativado, execute:

```powershell
python -B scripts/train_v6.py
```

A v6 compara os modelos original, `balanced` e `balanced_subsample` (400 árvores, folha mínima 10) e quatro médias ponderadas de probabilidades, em partições temporais de 2022–2025 com três sementes. Ela grava métricas, previsões fora da amostra, três joblibs e manifesto; não avalia 2026. Consulte o [relatório v6](reports/training/sixth_training_report.md). O procedimento completo para recriar o pacote do modelo está na seção [Recriar o candidato de integração v6](#recriar-o-candidato-de-integração-v6); os artefatos locais ficam em `data/experiments/`, ignorados pelo Git. A v5 segue disponível em [seu relatório](reports/training/fifth_training_report.md). Para a avaliação aninhada da v6, execute `python -B scripts/evaluate_test.py`; veja o [relatório v7](reports/training/seventh_training_report.md). Os artefatos ficam em `data/experiments/`, ignorados pelo Git.

### Recriar o candidato de integração v6

Com o CSV original disponível e `WEATHER_CSV_PATH` configurado no `.env`, um clone limpo pode gerar os artefatos usados pelo candidato. Use o Python 3.13.3 e as versões fixadas em `requirements.txt` para reproduzir o ambiente registrado no manifesto. Se a tabela preparada ainda não existir, gere-a primeiro:

```powershell
python -B scripts/prepare_weather.py
```

Depois execute o treinamento com uma pasta de saída nova e empacote o candidato a partir dela:

```powershell
python -B scripts/train_v6.py --output-dir data/experiments/weather_v6_group_reproduction
python -B scripts/package_weather_model.py --v6-dir data/experiments/weather_v6_group_reproduction --output-dir data/experiments/weather_v6_integration_candidate_group_reproduction
```

O treino gera os três joblibs finais e as previsões fora da amostra que o empacotador usa para ajustar os calibradores isotônicos. O pacote final do modelo, os calibradores e o manifesto ficam na segunda pasta. Os dois caminhos devem ser novos; se já existirem, escolha outros nomes. `data/experiments/` é ignorado pelo Git, então cada grupo gera os próprios arquivos localmente. Use exatamente o mesmo CSV, tabela processada e versões das dependências para comparar artefatos. Este procedimento reproduz o candidato técnico; não constitui nova avaliação independente nem aprovação operacional.

Para fazer a avaliação retrospectiva dos joblibs salvos de uma execução v5, o comando explícito é:

```powershell
python -B scripts/archive/train_v5.py --evaluate-test --output-dir data/experiments/weather_v5_20261104T120000Z
```

O script registra métricas e previsões no experimento e impede a repetição da avaliação na mesma pasta. Este período já foi consultado em ciclos anteriores, então seus resultados não são independentes nem devem orientar a seleção.

Cada execução exige uma pasta de saída nova e não sobrescreve experimentos existentes. A execução completa pode levar vários minutos. As pastas em `data/experiments/` são locais e excluídas do Git; não tente adicioná-las ao repositório.

Relatórios dos treinamentos:

- [Relatório da avaliação aninhada v7](reports/training/seventh_training_report.md)
- [Avaliador atual](scripts/evaluate_test.py)
- [Relatório da comparação v6](reports/training/sixth_training_report.md)
- [Relatório da comparação v5](reports/training/fifth_training_report.md)
- [Detalhe técnico da v4](reports/training/fourth_training_report.md)
- [Código de comparação v6](scripts/train_v6.py)
- [Empacotador do candidato de integração](scripts/package_weather_model.py)
- [Adaptador de inferência e atributos](src/models/weather_ensemble.py)
- [Código de comparação v5](scripts/archive/train_v5.py)
- [Avaliador histórico arquivado](scripts/archive/evaluate_legacy_test.py)
- [Treinamento histórico v4 arquivado](scripts/archive/train_v4.py)

## 5. Executar os testes

```powershell
python -B -m unittest discover -s tests -v
```

Os testes usam exemplos pequenos e não exigem o CSV real nem as imagens GOES.

Na revisão de 04/11/2026, a suíte completa passou em **51 testes**; `pip check` também passou nos ambientes `.venv` e `.venv-validacao`. Os testes não validam a semântica meteorológica da fonte nem demonstram desempenho operacional.

## Onde encontrar cada coisa

| Local | Conteúdo |
|---|---|
| `config.py` | Caminhos, fuso e nomes das quatro entradas |
| `scripts/prepare_weather.py` | Preparação da tabela do MVP |
| `scripts/archive/train_v5.py` | Comparação temporal repetida e registro de artefatos |
| `scripts/archive/` | Versões históricas dos scripts de treinamento |
| `tests/` | Verificações do código |
| `reports/project/` | Contratos para serviço de retaguarda, interface e Banco |
| `reports/project/` | Propostas e guia para as próximas decisões |
| `reports/training/` | Relatórios dos ciclos experimentais |
| `src/data/` | Auditoria, análise exploratória e investigação da origem |
| `src/features/` | Investigação e piloto GOES |
| `data/` | Dados e resultados locais, ignorados pelo Git |

Para alinhar as equipes: [serviço de retaguarda](reports/project/alinhamento_tres_equipes_integracao.md), [interface](reports/project/demandas_frontend_busca_e_previsao.md) e [Banco de Dados](reports/project/demandas_banco_busca_e_previsao.md). Esses documentos são contratos propostos; não significam que os serviços já estejam implementados. A tabela `predictions` proposta para o banco guarda previsões da API e é diferente da tabela de treinamento.

## Colaborar sem misturar as tarefas

Use `main` para código revisado e uma branch `feature/nome-curto` para cada tarefa:

```powershell
git switch main
git pull --ff-only
git switch -c feature/nome-curto
# Faça suas alterações e execute os testes.
git add caminho/do/arquivo.py
python scripts/check_staged.py
# Só continue se a verificação passar; confira o conteúdo abaixo.
git diff --cached
git commit -m "feat: descrever a alteração"
git push -u origin feature/nome-curto
```

Abra um solicitação de integração para `main` e peça a revisão de um colega. Cada pessoa mantém seus próprios caminhos no `.env`.

**No Git entram somente código e documentação.** CSV, NPZ, ZIP, amostras, resultados gerados, ambientes e credenciais ficam fora. O `.gitignore` e o hook ajudam a conferir isso; não use `git add -f` para incluir dados nem desative o hook para contornar uma rejeição. Tokens e senhas nunca devem entrar no código ou na documentação.

## Material de apoio

- [Estado detalhado e histórico do projeto](STATUS.md).
- [README original do conjunto de dados](docs/dataset/README.md), preservado.
- [Utilitários GOES](docs/goes_development.md): amostra local e leitura seletiva, para quem precisar investigar imagens. O acervo tem cerca de 73,8 GiB; não descompacte tudo.
- [Documentação histórica](docs/history/README_pre_github.md): reprodução das análises anteriores. Alguns resultados locais citados não acompanham o clone.

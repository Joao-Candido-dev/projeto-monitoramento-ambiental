# Relatório do sexto treinamento — v6

**Data:** 05/11/2026 18:08 UTC  
**Experimento:** `weather_v6_20261105T120000Z`  
**Script:** `scripts/train_v6.py`

## Objetivo

Comparar três Random Forests com a mesma estrutura e combinar suas probabilidades com quatro proporções previamente definidas. A intenção é verificar se a combinação equilibra a detecção de chuva e os falsos alarmes.

## Dados e procedimento

Fonte preparada: `weather_training.csv` (59.159 linhas, SHA-256 no manifesto). Foram usadas 52.607 linhas até 31/12/2025 para desenvolvimento, sete atributos, quatro partições cronológicas (2022–2025) e três sementes (17, 42, 2025). Cada partição respeita `target_time` na fronteira do ano. O período de 2026 não foi avaliado nem usado na seleção.

## Configurações

Todos os membros têm 400 árvores, folha mínima 10, `max_features=sqrt`, bootstrap habilitado, profundidade não limitada e demais parâmetros iguais. Variou apenas `class_weight`: sem pesos (`original`), `balanced` e `balanced_subsample`. Foram comparadas médias de probabilidades com pesos iguais (1/3 cada) e alternativas pré-definidas favorecendo cada família.

## Resultados

Médias e desvios-padrão sobre anos e sementes; limiar fixo de 0,50 para métricas de classificação.

| Estratégia | PR-AUC média | Brier médio | Sensibilidade média | F1 médio |
|---|---:|---:|---:|---:|
| ensemble_original_favor | 0.67319 | 0.09832 | 0.71511 | 0.63512 |
| ensemble_subsample_favor | 0.67316 | 0.10916 | 0.78082 | 0.62881 |
| ensemble_equal | 0.67315 | 0.10470 | 0.75967 | 0.63263 |
| ensemble_balanced_favor | 0.67278 | 0.11282 | 0.79829 | 0.62545 |
| balanced_subsample | 0.67268 | 0.11695 | 0.81075 | 0.62309 |
| original | 0.67198 | 0.08860 | 0.54255 | 0.59570 |
| balanced | 0.67119 | 0.12808 | 0.84769 | 0.60951 |

A combinação `ensemble_original_favor` teve a maior PR-AUC média (0,67319), mas a média simples ficou praticamente empatada (0,67315). A diferença de 0,00003 não indica vantagem prática clara. A combinação de pesos iguais teve sensibilidade média de 0,75967, acima do original (0,54255), e abaixo do `balanced_subsample` (0,81075). Seu Brier (0,10470) foi pior que o original (0,08860), mas melhor que `balanced` (0,12808) e `balanced_subsample` (0,11695). Isso mostra um compromisso entre detecção e qualidade probabilística, não um vencedor universal.

As quatro combinações foram comparadas nas mesmas partições e previsões fora da amostra. Como se compararam várias receitas de pesos, a maior média é uma escolha exploratória sobre essas mesmas partições e pode estar otimista. Não houve definição de custos relativos entre falso alarme e chuva não detectada nem avaliação futura independente; portanto, a v6 não define um vencedor operacional. O limiar permaneceu fixo em 0,50 e não foi otimizado.

## Artefatos e limites

O experimento contém três joblibs finais ajustados somente até 2025, `manifest.json` com parâmetros e hashes, métricas por partição/semente, resumo das estratégias e previsões fora da amostra. Não foram gravados resultados em PDF. O teste retrospectivo de 2026 foi deliberadamente preservado; já foi consultado em ciclos anteriores e não é cego. Para uma decisão operacional, definir custo/limiar usando desenvolvimento e avaliar em dados futuros ainda não consultados.


## Referências técnicas

- [RandomForestClassifier — parâmetros de classe, árvores e bootstrap](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html)
- [VotingClassifier — votação por probabilidades](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.VotingClassifier.html)
- [TimeSeriesSplit — validação que respeita a ordem temporal](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)
- [Precisão média (Average Precision) — métrica PR-AUC](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html)

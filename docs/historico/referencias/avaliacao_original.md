# Avaliação aninhada v7 — calibração, combinação e limiar

**Data:** 05/11/2026 19:40 UTC  
**Experimento:** `weather_v7_reassessment_20261105T`  
**Entrada:** `data/experiments/weather_v6_20261105T120000Z/predictions_oof.csv`

## Objetivo

Avaliar se calibrar probabilidades e escolher pesos/limiar somente em anos anteriores melhora a decisão no ano seguinte. Não retreina os Random Forests nem aprova uso operacional.

## Protocolo temporal

As partições externas são os anos de 2023, 2024 e 2025. Em cada ano, calibração, pesos e limiar são ajustados apenas com previsões fora da amostra dos anos anteriores; a partição externa mede a configuração congelada. Os resultados mantêm três sementes. O teste de 2026 não foi usado.

Compara original, `balanced_subsample`, média igual, `ensemble_original_favor` e combinação otimizada em grade simplex (passo 0,1; peso mínimo 0,1 por modelo). Calibração sem ajuste (`none`), sigmoide e isotônica. O limiar minimiza `FP + razão × FN` nos anos anteriores. Razões FN:FP: 0,5:1, 1:1, 2:1 e 5:1.

## Resultados por cenário

| Custo FN:FP | Política | Custo externo/linha | PR-AUC | Brier | Precisão | Sensibilidade | F1 | Limiar médio |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0.5:1 | ensemble_equal | 0.07380 | 0.67189 | 0.08629 | 0.8214 | 0.2213 | 0.3478 | 0.657 |
| 0.5:1 | original | 0.07416 | 0.66060 | 0.08640 | 0.8181 | 0.2201 | 0.3448 | 0.667 |
| 0.5:1 | ensemble_original_favor | 0.07431 | 0.67192 | 0.08627 | 0.8230 | 0.2081 | 0.3317 | 0.670 |
| 0.5:1 | balanced_subsample | 0.07435 | 0.66020 | 0.08650 | 0.8274 | 0.2030 | 0.3251 | 0.670 |
| 0.5:1 | ensemble_tuned | 0.07473 | 0.67190 | 0.08628 | 0.8218 | 0.2022 | 0.3237 | 0.667 |
| 1:1 | original | 0.12252 | 0.66060 | 0.08640 | 0.7104 | 0.4677 | 0.5601 | 0.540 |
| 1:1 | ensemble_original_favor | 0.12303 | 0.67192 | 0.08627 | 0.7091 | 0.4667 | 0.5585 | 0.507 |
| 1:1 | ensemble_equal | 0.12331 | 0.67189 | 0.08629 | 0.7060 | 0.4718 | 0.5603 | 0.500 |
| 1:1 | ensemble_tuned | 0.12355 | 0.67166 | 0.08634 | 0.7057 | 0.4698 | 0.5588 | 0.503 |
| 1:1 | balanced_subsample | 0.12412 | 0.66020 | 0.08650 | 0.6998 | 0.4775 | 0.5616 | 0.503 |
| 2:1 | original | 0.18737 | 0.66060 | 0.08640 | 0.6246 | 0.6359 | 0.6287 | 0.343 |
| 2:1 | ensemble_equal | 0.18997 | 0.67189 | 0.08629 | 0.6187 | 0.6297 | 0.6241 | 0.350 |
| 2:1 | balanced_subsample | 0.19001 | 0.66020 | 0.08650 | 0.6213 | 0.6263 | 0.6236 | 0.367 |
| 2:1 | ensemble_original_favor | 0.19019 | 0.67192 | 0.08627 | 0.6188 | 0.6286 | 0.6236 | 0.350 |
| 2:1 | ensemble_tuned | 0.19258 | 0.67211 | 0.08634 | 0.6310 | 0.6081 | 0.6175 | 0.357 |
| 5:1 | ensemble_equal | 0.29056 | 0.67189 | 0.08629 | 0.4868 | 0.8291 | 0.6117 | 0.180 |
| 5:1 | balanced_subsample | 0.29086 | 0.66020 | 0.08650 | 0.4890 | 0.8269 | 0.6127 | 0.193 |
| 5:1 | ensemble_tuned | 0.29126 | 0.67183 | 0.08635 | 0.4816 | 0.8350 | 0.6081 | 0.173 |
| 5:1 | ensemble_original_favor | 0.29220 | 0.67192 | 0.08627 | 0.4794 | 0.8358 | 0.6065 | 0.173 |
| 5:1 | original | 0.29625 | 0.66060 | 0.08640 | 0.4660 | 0.8440 | 0.5975 | 0.170 |

Pesos, calibrador e limiar por ano estão em `selected_configuration_by_fold.csv`; métricas em `outer_fold_metrics.csv`, previsões em `nested_predictions.csv`. `error_complementarity.csv` mede desacordo e sobreposição dos erros dos três membros em previsões fora da amostra a 0,50.

## Interpretação e limites

As razões de custo são cenários, não valores aprovados pela equipe. Há só três partições externas, e a escolha posterior entre políticas ainda pode ser otimista. Os resultados são evidência de desenvolvimento, não avaliação futura independente. Não se escolhe vencedor operacional sem aprovar custo ou limite máximo de alertas.

## Interpretação dos resultados

A combinação de pesos iguais (`ensemble_equal`) teve o menor custo médio nos cenários FN:FP de 0,5:1 e 5:1. O modelo original foi melhor nos cenários 1:1 e 2:1; portanto, não há uma estratégia que minimize o custo em todos os cenários. A média simples manteve PR-AUC de 0,67189 e Brier de 0,08629, ligeiramente melhores que o original (0,66060 e 0,08640) e próximos do `balanced_subsample` (0,66020 e 0,08650).

Quando o custo de não detectar chuva sobe para 5:1, a média simples atingiu sensibilidade de 0,8291, com precisão de 0,4868 e limiar médio de 0,180. No cenário 0,5:1, o limiar médio subiu para 0,657 e a sensibilidade caiu para 0,2213. Isso mostra que o limiar muda bastante conforme o custo escolhido. Como os custos ainda não foram aprovados e há somente três partições externas, esses resultados orientam a discussão, mas não estabelecem uma política operacional definitiva.

A v7 não grava joblibs finais porque ainda não existe critério aprovado para congelar uma combinação. Após essa decisão, treinar a configuração final em todo o desenvolvimento, fixar o manifesto e avaliar somente em dados futuros ainda não consultados.

## Referências

- [RandomForestClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html)
- [Calibração de probabilidades](https://scikit-learn.org/stable/modules/calibration.html)
- [TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)
- [Precisão média (Average Precision) / PR-AUC](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html)

## Preparação para integração

Após a avaliação, foi preparado o candidato `weather-v6-simple-mean-isotonic-v1`: os três membros calibrados isotonicamente são combinados com pesos 1/3 e limiar provisório 0,50. O pacote do modelo e o manifesto estão em `data/experiments/weather_v6_integration_candidate_20261105T190315Z/`. O teste de 2026 continua sem uso; a escolha prepara a integração histórica e não representa aprovação operacional independente.

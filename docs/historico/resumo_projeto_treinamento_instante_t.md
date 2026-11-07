# Resumo do projeto, treinamento e instante T

**Registro:** 07/11/2026. Objetivo: guardar o contexto necessário para entender a aplicação sem depender das conversas. Resultados abaixo são registros dos relatórios anteriores; não houve novo treinamento nem nova auditoria dos dados nesta organização.

## 1. O que queremos entregar

Um MVP de Londrina que usa dados meteorológicos para estimar a ocorrência de chuva na próxima hora. A primeira integração é uma **simulação histórica**: o usuário escolhe uma data/hora, o backend consulta as medidas, executa o modelo pronto e salva a previsão para consulta posterior.

A **v6 está definida para esta integração**. Imagens GOES ficam fora deste fluxo e podem ser retomadas depois. O objetivo atual é integrar e compreender o sistema, sem prometer uma previsão operacional em tempo real.

## 2. O que fizemos até aqui

| Etapa | Trabalho e significado |
|---|---|
| Auditoria e EDA | Investigação do CSV, datas, ausências, distribuições, chuva, cobertura e relação com as imagens. Identificação de limitações antes da modelagem. |
| Estudo GOES | Inspeção seletiva de NPZ, metadados, pixels inválidos, grades/satélites, horários e localização. O piloto documenta 19 imagens selecionadas; não é uma inspeção de todos os pixels do acervo. |
| Redução do escopo | A primeira aplicação passou a usar somente dados tabulares. Geolocalização e imagens posteriores continuam questões para uma etapa futura, sem bloquear o MVP atual. |
| Preparação da tabela | Associação das quatro medidas em T com chuva em T+1h pelo horário exato, sem transformar uma lacuna em próxima hora. |
| Experimentos de treinamento | Evolução registrada nos relatórios v1 a v6. A v6 compara três Random Forests e combina suas probabilidades. A avaliação v7 investiga calibração/combinação/limiar usando resultados da v6. |
| Definição da integração | Fluxo por data/hora, responsabilidades das três equipes, histórico e regra de reenvio sem duplicação. |
| Novo repositório | Frontend existente, adaptador v6, servidor inicial, testes e documentação essencial separados. Estudos completos continuam no repositório de pesquisa. |

As inspeções GOES apontaram pixels inválidos, diferenças de grades e dúvidas sobre a localização/representatividade regional e disponibilidade temporal. A inspeção amostral não prova homogeneidade de todo o conjunto. Não tratamos a imagem inteira como medida validada de Londrina.

## 3. O que é o instante T

**T é o horário de referência das entradas**, usado como instante de emissão no experimento. **T+1h é o horário do alvo**, isto é, a resposta que queremos prever.

Exemplo: para T = 14h, usamos temperatura, umidade, pressão e nuvens das 14h. Na v6, também precisamos da pressão das 13h para calcular a variação de pressão. O alvo consulta `rain` das 15h.

O código interpreta horários sem fuso como `America/Sao_Paulo`, conforme a documentação do dataset. No período analisado, 14h local corresponde a 17h UTC. Não converter horários subtraindo horas manualmente.

**Hipótese temporal do experimento:** `rain(u)` representa o acumulado em `(u−1h, u]`. Sob essa hipótese, a chuva registrada às 15h descreve o intervalo depois das 14h até as 15h.

**Limitação:** o horário escrito no CSV não confirma sozinho a janela física do acumulado nem quando as medidas ficaram disponíveis. A revisão original registra que a associação por horário foi verificada, mas a origem e a disponibilidade histórica exigem evidência do produtor/exportação. Por isso chamamos o uso atual de simulação histórica.

## 4. Alvo e entradas

O alvo preparado é `rain_next_hour = 1` quando `rain(T+1h) > 0 mm`; caso contrário, 0. É previsão de ocorrência, não de volume de chuva. `rain` e `precipitation` não devem ser trocados sem revisar a definição.

| Entrada do modelo v6 | Como obter |
|---|---|
| `temperature_2m` | Temperatura em T |
| `relative_humidity_2m` | Umidade em T |
| `pressure_msl` | Pressão ao nível do mar em T |
| `cloud_cover` | Cobertura de nuvens em T |
| `temp_humidity` | Temperatura × umidade em T |
| `pressure_diff` | Pressão em T menos pressão de exatamente T−1h |
| `hour_of_day` | Hora de T convertida para America/Sao_Paulo |

Sete features não significam sete campos para o usuário. O banco fornece cinco medidas, e o backend calcula as três derivadas a partir delas e do horário. Chuva futura não entra no modelo. A pressão anterior precisa ter seu horário conferido: um valor numérico sozinho não comprova T−1h.

A revisão de 22/10 registra 59.159 linhas elegíveis, de 01/01/2020 00h até 30/09/2026 22h, 10.120 alvos positivos (aproximadamente 17,11%) e ausência de lacunas internas, duplicatas e ausentes nas sete colunas da tabela daquela etapa. A última linha original foi excluída por não existir a próxima hora para formar o alvo. Essas sete colunas da tabela inicial **não são as sete features posteriores da v6**: a tabela inicial continha horários, quatro medidas e alvo.

## 5. Como foi o treinamento v6

Conforme o [relatório original](referencias/treinamento_v6_original.md):

- 52.607 linhas de desenvolvimento até 31/12/2025, a partir da tabela de 59.159 linhas.
- Quatro partições cronológicas de avaliação, 2022 a 2025, e sementes 17, 42 e 2025. Cada partição limita também o horário do alvo na fronteira do ano.
- Três Random Forests: sem pesos de classe, `balanced` e `balanced_subsample`. Os pesos alteram a atenção dada às classes chuva/sem chuva.
- Cada modelo tem 400 árvores e mínimo de 10 exemplos por folha. Foram comparadas quatro combinações de probabilidades.
- Na comparação v6, a média com pesos iguais teve PR-AUC 0,67315, sensibilidade 0,75967, F1 0,63263 e Brier 0,10470, em médias sobre anos/sementes.

PR-AUC resume a relação entre precisão e detecção da chuva; sensibilidade mede a fração de chuvas detectadas; F1 combina precisão e sensibilidade; Brier mede erro das probabilidades, com menor sendo melhor. **Esses números não são a acurácia da aplicação nem uma medição do pacote final já integrado.**

A avaliação complementar v7 reusa previsões fora da amostra da v6 para estudar calibração, pesos e limiares em anos seguintes. Não é outro conjunto de Random Forests treinado para a interface. O relatório v6 informa que 2026 não foi utilizado naquele experimento, mas já havia sido consultado em ciclos anteriores: portanto não deve ser chamado de teste cego independente.

## 6. Qual modelo a aplicação usará

O contrato define `weather-v6-simple-mean-isotonic-v1`: três membros v6, probabilidades calibradas por ajuste isotônico e média com pesos iguais. O empacotador de origem usa limiar inicial 0,50. A interface mostra a classificação e o limiar devolvidos pelo backend, sem escolher outra regra.

O código de inferência foi preservado em `backend/src/models/weather_ensemble.py`. O treinamento e o empacotamento continuam no repositório de pesquisa.

**Pendência material:** o arquivo `weather_ensemble.joblib` e seu manifesto não foram encontrados nas pastas locais examinadas. Os relatórios descrevem os artefatos, mas isso não significa que eles estejam disponíveis neste clone. Precisamos recebê-los do responsável, verificar origem, hash, versão e ambiente e validar uma previsão conhecida. Não é necessário retreinar se o pacote já existe.

## 7. Cuidados contra informação do futuro

- Usar apenas medidas dos horários permitidos; o alvo futuro serve como resposta no treinamento, nunca como entrada.
- Em operação real, comprovar que cada medida chegou até T; a ordenação cronológica não resolve atrasos de publicação.
- Separar períodos por tempo, sem embaralhamento. Impedir que alvos do treino atravessem a fronteira da validação ou do teste.
- Aprender imputação, normalização e outras transformações somente no treino; escolher configurações na validação.
- Não apresentar períodos já consultados como teste independente. Uma simulação escolhida na interface também não é uma avaliação científica nova.

## 8. Situação da aplicação e próximo passo

A organização atual tem frontend React/Vite, backend Flask com `/health`, adaptador v6 e documentação das três equipes. Foram aprovados 6 testes do backend, 51 do frontend, lint e build; as páginas e `/health` responderam por HTTP. Isso valida a base, não a previsão real nem a conexão com Supabase.

Ainda faltam: obter/verificar o pacote, confirmar as consultas de T e T−1h, implementar previsão e persistência, adaptar a tela por data/hora e testar o histórico. O formulário antigo ainda não atende ao contrato novo.

Uma solicitação intencional gera uma chave `Idempotency-Key`. Reenvio do mesmo pedido mantém a chave e recupera o mesmo resultado; não deve duplicar a gravação. O treinamento não roda a cada clique. O banco salva cada previsão solicitada e suas entradas, não todas as saídas de todos os experimentos.

**Referência atual:** [README da aplicação](../../README.md), [continuidade](../continuidade.md) e [alinhamento das equipes](../integration/alinhamento_tres_equipes_integracao.md).

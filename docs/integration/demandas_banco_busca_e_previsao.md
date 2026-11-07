# Demandas ao Banco de Dados — busca histórica e previsões

**Projeto:** Chuva Londrina · **Data:** 07/11/2026
**Status:** requisitos revisados para implementação com v6. Este documento não cria nem altera tabelas.

## Referência desta revisão — v6 definida para a integração

**Decisão definida pela equipe:** a v6 é a versão final de treinamento desta etapa e a base desta integração do MVP histórico. Não é necessário escolher outro treinamento para implementar este fluxo. Isso não significa aprovação para previsão em tempo real ou avaliação futura independente.

O serviço carregará `weather_ensemble.joblib`, produzido por `scripts/package_weather_model.py` no repositório de pesquisa original a partir dos três Random Forests da v6. O pacote combina as probabilidades calibradas dos três modelos com pesos iguais. A versão documentada é `weather-v6-simple-mean-isotonic-v1`. O empacotador atual usa limiar 0,50; a API deve devolver o limiar e a versão do pacote carregado, e o Frontend deve exibi-los sem recalcular a classificação. A avaliação v7 complementa os estudos da v6; não é outro treinamento a ser executado pela interface.

Antes de atender pedidos reais, o Backend deve obter e verificar o arquivo do modelo e seu manifesto. Esses artefatos não acompanham o clone. **O servidor carrega o modelo já treinado; não executa `train_v6.py` a cada previsão.**

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

O corpo histórico permanece somente com `mode` e `reference_time`. Toda resposta de sucesso, inclusive no histórico, inclui o `request_id` correspondente. Esta é uma regra definida para implementação; ela ainda não existe como serviço pronto no repositório.

**Referência para este fluxo:** estes três documentos revisados usam busca automática pelo Backend e POST com T/modo. Eles substituem, para esta integração histórica, a proposta antiga de enviar medidas manualmente em `docs/integration/`. Os três contratos antigos foram removidos; estes documentos são a referência vigente da integração. O formulário manual é secundário e não define o contrato principal.

## 1. Objetivo

Permitir que o Backend consulte dados meteorológicos históricos e salve cada previsão solicitada pelo usuário. O Supabase armazena os dados; o Backend executa o modelo; o Frontend apresenta os resultados.

Nesta primeira versão, o usuário seleciona uma data e uma hora do histórico. A aplicação estima chuva na hora seguinte. É uma **simulação histórica**, não uma previsão em tempo real.

## 2. O que será armazenado

| Informação | Onde fica | Responsabilidade |
|---|---|---|
| Dados meteorológicos históricos | Tabela já existente no Supabase | Banco mantém a base consultável. |
| Modelo treinado e arquivos dos experimentos | Arquivos controlados pelo Backend; local definitivo a combinar | Backend prepara e disponibiliza uma versão verificada. |
| Previsões solicitadas pela aplicação | Tabela de previsões no Supabase | Backend grava; Banco define a estrutura e o acesso. |

**Não vamos gravar todo o resultado do treinamento em uma tabela da aplicação.** O arquivo do modelo, relatórios e métricas continuam separados. Cada previsão registra qual versão do modelo a gerou.

Também não precisamos calcular previamente uma previsão para cada linha do dataset. A primeira entrega funciona sob demanda: o usuário solicita, o Backend calcula e salva. Processamento em lote poderá ser discutido depois.

## 3. Como funciona uma solicitação

Exemplo: o usuário seleciona **01/09/2026 às 14h**.

1. Ao clicar em **Buscar dados**, o Backend consulta as quatro medidas das 14h e a pressão das 13h. Essa consulta não cria uma previsão.
2. O Frontend mostra as entradas encontradas.
3. Ao clicar em **Gerar previsão experimental**, o Backend consulta e valida novamente os dados.
4. O Backend executa o modelo já treinado. Não há novo treinamento a cada pedido.
5. O Backend grava as entradas utilizadas e o resultado juntos.
6. Somente depois da confirmação da gravação, devolve sucesso ao Frontend.
7. Ao abrir o histórico, a aplicação lê os resultados salvos; não executa o modelo novamente.

## 4. Dados que o Banco precisa fornecer

Confirmar o nome e a estrutura da tabela meteorológica. O frontend atual consulta `dataset_weather_goes`, mas o esquema efetivo deve ser compartilhado pela equipe do Banco.

| Horário | Colunas necessárias | Unidade |
|---|---|---|
| T | `temperature_2m` | °C |
| T | `relative_humidity_2m` | % |
| T | `pressure_msl` | hPa |
| T | `cloud_cover` | % |
| Exatamente T−1h | `pressure_msl` | hPa |

O Backend usa essas medidas para calcular também diferença de pressão, temperatura × umidade e hora do dia. O Banco não precisa executar o modelo nem esses cálculos na primeira entrega.

Requisitos da consulta:

- Identificar um único registro para Londrina em cada horário. Se houver duplicatas, definir como resolver a ambiguidade antes da integração.
- Preservar a identificação do registro, quando existir.
- Confirmar unidade e significado do campo de horário. Não converter os dados existentes sem verificar como foram carregados.
- Permitir consultar T e exatamente T−1h. Não substituir a hora anterior por qualquer linha anterior disponível.
- Permitir obter o período disponível e os horários elegíveis de cada dia.
- Não exigir chuva futura para gerar a previsão. O modelo recebe apenas as entradas necessárias.

Se faltar a pressão de T−1h ou outra entrada obrigatória, o Backend deve informar a indisponibilidade. Não preencher com zero silenciosamente.

## 5. Tabela de previsões proposta

Nome a combinar: o frontend menciona `resultados_previsoes_ia`, enquanto documentos anteriores usam `predictions`. **Se já existir uma tabela adequada, preferimos adaptá-la em vez de criar outra com a mesma finalidade.** Compartilhar o script que descreve sua estrutura antes da alteração.

Tipos sugeridos para PostgreSQL, banco utilizado pelo Supabase:

| Campo | Tipo sugerido | Finalidade |
|---|---|---|
| `prediction_id` | UUID, chave primária | Identificação única da previsão. |
| `request_id` | UUID, único | Identificar o pedido e evitar duplicação em reenvios acidentais. |
| `created_at` | TIMESTAMPTZ | Quando a execução foi registrada; preenchido pelo servidor. |
| `location` | TEXT | Londrina-PR nesta versão. |
| `reference_time` | TIMESTAMPTZ | Horário histórico T selecionado. |
| `previous_reference_time` | TIMESTAMPTZ | Horário da pressão anterior, exatamente T−1h. |
| `forecast_start` | TIMESTAMPTZ | Início da janela, igual a T. |
| `forecast_end` | TIMESTAMPTZ | Fim da janela, igual a T+1h. |
| `temperature_2m` | DOUBLE PRECISION | Temperatura utilizada em T. |
| `relative_humidity_2m` | DOUBLE PRECISION | Umidade utilizada em T. |
| `pressure_msl` | DOUBLE PRECISION | Pressão utilizada em T. |
| `cloud_cover` | DOUBLE PRECISION | Nuvens utilizadas em T. |
| `pressure_msl_previous_hour` | DOUBLE PRECISION | Pressão utilizada em T−1h. |
| `rain_probability` | DOUBLE PRECISION | Probabilidade de 0 a 1; por exemplo, 0,72. |
| `rain_predicted` | BOOLEAN | Classificação devolvida pelo modelo. |
| `decision_threshold` | DOUBLE PRECISION | Limiar utilizado para transformar probabilidade em classe. |
| `model_version` | TEXT | Identificação da versão utilizada. |
| `mode` | TEXT | `historical` nesta entrega. |
| `is_mock` | BOOLEAN | Distingue resposta fictícia de execução real do modelo. |
| `input_source` | TEXT | `dataset` para a busca histórica. |
| `source_record_id` | Tipo da chave da tabela de origem, opcional | Referência ao registro em T, quando disponível. |
| `previous_source_record_id` | Tipo da chave da origem, opcional | Referência ao registro em T−1h, quando disponível. |

Os campos principais são obrigatórios. As referências à origem dependem das chaves existentes. `model_version` só pode ficar nulo em resposta fictícia; previsões reais exigem uma versão identificada. Fixtures de desenvolvimento não devem entrar no histórico real.

Salvar uma cópia das cinco medidas utilizadas, mesmo mantendo referências à tabela meteorológica. Assim, uma correção futura no dataset não apaga o que foi usado naquela execução.

## 6. Regras simples de integridade

- Probabilidade e limiar entre 0 e 1.
- Umidade e cobertura de nuvens entre 0 e 100; pressões positivas.
- Valores meteorológicos finitos e não nulos. O Backend valida e o Banco aplica restrições compatíveis.
- `forecast_start = reference_time`, `forecast_end = reference_time + 1 hora` e `previous_reference_time = reference_time − 1 hora`.
- Classificação coerente com `rain_probability >= decision_threshold`.
- Criar índice para consultar o histórico por `created_at` e identificação. Índices da tabela meteorológica devem apoiar a busca por local e horário.
- Não criar unicidade somente por T: o mesmo horário pode ser previsto várias vezes, com novas versões ou dados corrigidos.

Os tipos com fuso representam instantes. A API deve enviar horários com offset e a tela deve apresentar `America/Sao_Paulo`. O fuso da tabela meteorológica existente precisa ser confirmado separadamente.

## 7. Repetições, falhas e acesso

**Reenvio do mesmo pedido:** implementar a regra única descrita no início deste documento. O Banco garante `request_id` único; o Backend reconhece pedidos concluídos/em andamento e devolve o resultado original; o Frontend preserva a chave e não repete automaticamente.

**Nova solicitação intencional:** gerar outro identificador e permitir outra previsão para o mesmo T. Não usar a data/hora como identificador do pedido.

**Falha de gravação:** não devolver sucesso como se a previsão estivesse no histórico. Entrada e resultado devem ser gravados em uma única operação consistente. Não é necessário criar uma tabela de erros nesta entrega.

**Acesso:** somente o Backend deve gravar previsões. A leitura do histórico será oferecida pela API. A leitura autorizada da EDA diretamente pelo Frontend pode continuar. Credenciais privilegiadas do banco ficam apenas no servidor; a equipe do Banco deve fornecer permissões adequadas e instruções de conexão, sem colocar senhas no Git.

## 8. Histórico: qual data será usada

Exemplo: uma simulação gerada em **07/11/2026** usando dados de **01/09/2026 às 14h** aparece no histórico de execuções de novembro.

- `created_at`: data de execução, usada inicialmente no filtro “Últimos 7 dias”.
- `reference_time`: data histórica utilizada, apresentada em outra coluna.
- `forecast_start` e `forecast_end`: intervalo previsto.

As consultas precisam retornar todas as execuções do intervalo, com paginação, da mais recente para a mais antiga. Um período vazio é diferente de falha na consulta. Não retornar apenas a primeira previsão de um dia.

## 9. Entregas esperadas da equipe do Banco

1. Confirmar tabela meteorológica, colunas, chaves, unidades e fuso.
2. Compartilhar a estrutura da tabela de previsões existente, se houver.
3. Criar ou adaptar a tabela e suas restrições por um script de alteração versionado.
4. Disponibilizar acesso de leitura meteorológica e gravação/consulta de previsões ao Backend.
5. Conferir com o Backend consultas de T/T−1h e de histórico.

### Checklist de aceite

- [ ] É possível encontrar as medidas em T e a pressão de exatamente T−1h.
- [ ] Ausência e duplicidade de registros são identificáveis.
- [ ] Um pedido válido salva entradas e resultado com um ID único.
- [ ] Reenvio com a mesma chave não cria outra linha.
- [ ] Uma nova solicitação para o mesmo T pode criar outra execução.
- [ ] A execução aparece no histórico após recarregar a página.
- [ ] Os valores no histórico são iguais aos usados e devolvidos pelo Backend.
- [ ] Acesso não autorizado não permite gravar previsões.

**Referência complementar:** [Demandas do Frontend](demandas_frontend_busca_e_previsao.md). Os detalhes finais de nomes, acesso e repetição de pedidos devem ser aprovados em conjunto antes da integração real.


## Localização nesta aplicação

O adaptador fica em `backend/src/models/weather_ensemble.py`. Treinamento, empacotamento e estudos permanecem no repositório de pesquisa; não são executados pelo servidor. O README da raiz informa o que já funciona. As rotas de previsão deste contrato ainda precisam ser implementadas.

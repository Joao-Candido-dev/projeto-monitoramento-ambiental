# Alinhamento das três equipes — primeira integração

**Projeto:** Chuva Londrina · **Data:** 07/11/2026
**Status:** plano revisado de integração com v6 definida para esta etapa. Serviços e tabelas ainda serão implementados.

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

## 1. Entrega que queremos colocar para funcionar

O usuário seleciona uma data e uma hora histórica de Londrina, consulta os dados, solicita uma previsão de chuva para a próxima hora e encontra essa execução no histórico.

O modelo será executado pelo Backend. Os dados e as previsões ficam no Supabase. O Frontend organiza a interação e mostra os resultados.

Não será necessário digitar as medidas meteorológicas. Também não haverá treinamento a cada solicitação: o serviço usa um modelo já treinado e verificado. A modalidade inicial é **simulação histórica**.

## 2. Fluxo combinado

| Passo | Frontend | Backend | Banco de Dados |
|---|---|---|---|
| 1. Selecionar horário | Mostra calendário e horas disponíveis | Consulta disponibilidade e responde | Fornece registros históricos |
| 2. Buscar dados | Solicita T e mostra medidas, sem edição | Busca e valida T e T−1h | Retorna as medidas dos horários exatos |
| 3. Gerar previsão | Envia T e modo histórico | Consulta novamente, prepara entradas e executa o modelo | Fornece os dados necessários |
| 4. Salvar resultado | Aguarda confirmação | Grava entradas e resultado; devolve sucesso após salvar | Persiste a execução |
| 5. Ver histórico | Lista as execuções e seus detalhes | Consulta e pagina os registros | Retorna previsões salvas |

**Buscar dados não salva previsão. Gerar previsão executa e salva. Consultar o histórico não executa o modelo novamente.**

## 3. O que cada equipe precisa fazer

### Frontend

- Adaptar “Integração” para a tela **Previsão experimental**.
- Criar seleção de data/hora e botões **Buscar dados** e **Gerar previsão experimental**.
- Exibir temperatura, umidade, pressão, nuvens e pressão da hora anterior com suas unidades.
- Mostrar carregamento, falta de dados, erro e resultado de forma distinta.
- Limpar o estado anterior ao mudar data/hora e impedir que respostas atrasadas substituam a seleção atual.
- Mostrar classificação, probabilidade, janela, modo, versão e identificação da execução.
- Transformar “Últimos 7 dias” em histórico de execuções, preservando o resumo meteorológico diário dentro da EDA.
- Desenvolver primeiro com respostas simuladas identificadas, usando o contrato acordado.

### Backend

- Obter o pacote do modelo v6 definido para integração e seu manifesto, que não acompanham o Git; verificar versões e carregamento.
- Preparar as rotas de disponibilidade, busca de entradas, previsão e histórico.
- Buscar quatro medidas em T e pressão de exatamente T−1h; rejeitar entradas incompletas ou ambíguas.
- Calcular os atributos derivados como no treino e chamar o modelo já carregado.
- Salvar as entradas efetivamente usadas e o resultado; devolver os mesmos valores ao Frontend.
- Tratar falhas e repetições de pedidos, sem inventar probabilidade.
- Configurar endereço, acesso e origens permitidas para o Frontend.

### Banco de Dados

- Confirmar tabela meteorológica, colunas, unidades, fuso e identificação dos registros.
- Permitir consultas eficientes por local e horário, inclusive T−1h.
- Criar ou adaptar a tabela de previsões, com entradas, resultado, versão e datas separadas.
- Definir restrições, índices e acesso do Backend.
- Garantir que reenvio do mesmo pedido não duplique a gravação.
- Entregar o script da estrutura e conferir inserção e consulta com a equipe do Backend.

## 4. Acordos essenciais

| Tema | Proposta para a primeira entrega |
|---|---|
| Local | Londrina, sem previsão por bairro. |
| Horizonte | Uma hora após T. |
| Entrada do usuário | Data e hora; nenhuma medida meteorológica obrigatória para digitação. |
| Entrada do modelo v6 | Quatro medidas em T e pressão em T−1h; o Backend deriva sete atributos. |
| Origem dos dados | Histórico no Supabase. Não apresentar como condições atuais. |
| Probabilidade | API retorna de 0 a 1; tela exibe em percentual. Não chamar de acurácia. |
| Classificação | Vem do Backend; Frontend não escolhe outro limiar. |
| Gravação | Uma execução confirmada gera um registro; somente o Backend escreve previsões. |
| Histórico | Filtrado inicialmente pela data de execução, não pela data histórica selecionada. |
| Treinamento | Separado do atendimento ao usuário. Arquivo do modelo não precisa ficar em tabela SQL. |
| GOES | Trabalho paralelo de investigação; não é requisito para esta integração tabular. |

A v6 está definida para esta integração. Usar o pacote `weather-v6-simple-mean-isotonic-v1`, após conferir seu manifesto e carregamento. O serviço deve respeitar as entradas, versão e limiar do pacote, conforme a referência desta revisão.

## 5. Rotas propostas e desenvolvimento em paralelo

| Rota | Função |
|---|---|
| `GET /available-times` | Informar limites de datas disponíveis. |
| `GET /available-times?date=AAAA-MM-DD` | Listar horários elegíveis do dia. |
| `GET /weather-inputs?reference_time=...` | Mostrar as entradas de T e a pressão de T−1h. |
| `POST /predict` | Receber T e modo histórico, gerar e salvar uma previsão. |
| `GET /predictions?created_from=...&created_to=...&limit=20&cursor=...` | Consultar o histórico paginado. |

Essas rotas são propostas, não serviços já disponíveis. O frontend atual usa `/previsao` e `/historico`; as equipes precisam alinhar e adaptar o cliente para o contrato escolhido.

O POST histórico envia `mode` e `reference_time` no corpo e `Idempotency-Key` no cabeçalho; não precisa enviar as medidas do quadro. O resultado devolve as entradas efetivamente usadas, pois a consulta pode ter sido atualizada entre busca e geração.

**Proteção contra duplicação:** aplicar a regra única de reenvio desta revisão: UUID no cabeçalho, `request_id` único no Banco, retorno do registro original em repetições e 409 para conflito ou pedido ainda em processamento.

O Frontend pode montar a tela e seus testes com exemplos de respostas. O Banco pode preparar o esquema ao mesmo tempo em que o Backend implementa as rotas. A conexão real acontece após confirmar nomes, tipos, URL e mensagens de erro.

## 6. EDA: manter uma responsabilidade separada

O Frontend e a equipe do Banco continuam responsáveis pela exploração dinâmica: gráficos de temperatura, chuva, resumos por período e cobertura dos dados. Agregações maiores devem ser feitas no Banco; a tela apresenta os resultados.

EDA descreve o histórico. Previsão é uma saída do modelo. Não substituir uma probabilidade do modelo pela frequência histórica de chuva nem misturar essas informações sob o mesmo título.

A leitura autorizada da EDA diretamente pelo Frontend pode continuar; a busca de entradas para inferência e a persistência de previsões ficam sob controle do Backend.

## 7. Ordem prática das entregas

1. **Alinhamento curto:** fechar contrato, nome da tabela de previsões, fuso e acesso; aplicar a versão v6 e a regra de reenvio definidas nesta revisão.
2. **Trabalho paralelo:** Frontend desenvolve com exemplos; Banco prepara estrutura e consultas; Backend prepara o serviço e carrega o pacote.
3. **Primeiro fluxo real:** selecionar um horário, buscar dados, gerar, salvar e visualizar uma previsão.
4. **Histórico:** listar a execução após atualizar a página; diferenciar data de geração e data de referência.
5. **Testes conjuntos:** conferir sucesso, ausência de T−1h, erro de entrada, falha de serviço e reenvio do mesmo pedido.

Não precisamos treinar outro modelo para implementar calendário, consultas, resultado e histórico. A execução real depende de obter e validar o pacote v6 e seu ambiente.

## 8. Como saber que a integração funcionou

- [ ] O usuário conclui o fluxo sem digitar as medidas meteorológicas.
- [ ] As medidas são do mesmo T e a pressão anterior é de exatamente T−1h.
- [ ] A previsão usa o modelo real; qualquer mock está claramente identificado.
- [ ] O ID recebido na tela corresponde a uma linha no Supabase com os mesmos valores.
- [ ] O histórico permanece disponível após recarregar a aplicação.
- [ ] Reenvio acidental não duplica a execução; nova solicitação pode usar o mesmo T.
- [ ] Falta de dados ou erro não aparece como “sem chuva”.
- [ ] As três equipes conseguem explicar sua parte e executar o procedimento de integração.

## Documentos de apoio

- [Demandas do Frontend: fluxo e exemplos de JSON](demandas_frontend_busca_e_previsao.md).
- [Demandas do Banco: persistência, campos e consultas](demandas_banco_busca_e_previsao.md).

**Ponto de atenção:** esta integração demonstra o uso do modelo com dados históricos. Ela não comprova previsão em tempo real nem desempenho em dados futuros. Fonte operacional e avaliação independente serão etapas posteriores.


## Localização nesta aplicação

O adaptador fica em `backend/src/models/weather_ensemble.py`. Treinamento, empacotamento e estudos permanecem no repositório de pesquisa; não são executados pelo servidor. O README da raiz informa o que já funciona. As rotas de previsão deste contrato ainda precisam ser implementadas.

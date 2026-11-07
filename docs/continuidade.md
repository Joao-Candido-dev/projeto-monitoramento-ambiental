# Continuidade da integração

## Origem e escopo desta organização

- Backend de origem: `victorhukra/backend-monitoramento-ambiental`, base documental no commit `1ee4f59`.
- Frontend de origem: cópia local de `C:/Users/CANAL/Frontend-ProjetoIntegrador`; fontes, testes e lockfile preservados.
- Os dois READMEs originais estão preservados integralmente em `docs/originals/`. Podem conter links relativos que só existem nos projetos antigos; não são o guia de execução desta aplicação.
- Nenhum repositório de origem foi apagado ou alterado. Estudos, resultados e dados continuam lá.

## O que foi trazido

Frontend, testes existentes, dependências fixadas pelo lockfile e a geometria pública do mapa. No backend, o adaptador v6 foi copiado sem alterar suas contas. O caminho `src.models.weather_ensemble` foi mantido porque o arquivo serializado do modelo pode depender dele. Acrescentamos somente servidor Flask com `/health`, configuração mínima de fuso e testes de features/servidor.

Não vieram auditorias, EDA, GOES, treinamento, relatórios científicos, dados, ambientes ou workflows de publicação do frontend antigo. Os scripts v6 e de empacotamento dependem de módulos antigos; permanecem completos no repositório de pesquisa. Não precisamos copiá-los para servir um modelo pronto. A publicação deve ser configurada para este novo repositório quando for escolhida a hospedagem.

## Próximas entregas, em ordem

1. **Modelo:** obter pacote v6 e manifesto do responsável; conferir hash, versão e bibliotecas; validar uma previsão conhecida e carregar uma vez por processo. Sem isso, não declarar inferência real disponível. Nenhum artefato foi encontrado/migrado nesta organização.
2. **Banco:** confirmar nomes/tipos das colunas meteorológicas, timezone e acesso a quatro medidas em T e pressão em T−1h; criar persistência de previsões conforme contrato. Não foi executada nenhuma mudança no Supabase.
3. **Backend:** implementar consultas de disponibilidade/entradas, validação horária, previsão, gravação e histórico. Aplicar unicidade de `request_id`, controle de concorrência e regra de reenvio dos três documentos. Não retornar sucesso de gravação antes de persistir. Liberar CORS apenas para as origens acordadas e incluir `Idempotency-Key` no preflight.
4. **Frontend:** substituir o formulário manual pelo fluxo data/hora → buscar medidas → gerar previsão; adaptar `src/services/previsaoApi.js`, componentes de formulário/resultado/histórico e a seção de últimos sete dias. Preservar chave/corpo de pedidos incertos inclusive após recarga da página.
5. **Integração:** verificar ausência de dados, erro de rede, pedido simultâneo/repetido, resultado salvo e histórico após recarregar. Conferir o mesmo ID e os mesmos valores no banco e na tela. Usar mocks somente identificados e nos testes.

## Critério de conclusão futura

O usuário escolhe T, vê dados de T e T−1h, gera uma previsão real da v6 e encontra exatamente uma execução persistida ao reenviar o mesmo pedido. A tela identifica simulação histórica, janela T→T+1h, probabilidade, versão e ID. Isso ainda não está concluído e não equivale a previsão operacional em tempo real.

## Validação desta organização

Validação local em 07/11/2026:

- Backend: 6 testes aprovados; `pip check` sem incompatibilidades.
- Frontend: 51 testes aprovados, lint sem erros e build concluído.
- HTTP real: `/health`, página inicial e `/integracao` responderam 200 em portas temporárias; processos encerrados após a conferência.
- Corrigidos dois erros de lint preexistentes no componente de comparação de períodos, preservando o fluxo assíncrono de consultas.
- READMEs originais e adaptador v6 conferidos por conteúdo contra as fontes.
- Ambiente Python verificado congelado em `backend/requirements-lock.txt`; lista de dependências diretas em `requirements.txt`.
- `npm audit`: quatro alertas moderados na cadeia de desenvolvimento ESLint/minimatch. Sem alteração automática de versão principal; revisar antes de configurar CI/publicação. O build passou, mas isso não elimina os alertas.
- Dados, modelos, ambientes e credenciais fora do índice Git. A geometria pública de Londrina é uma exceção explícita necessária ao mapa.

Não foram executados treino, avaliação científica, carregamento do modelo real nem integração com Supabase. Os testes do frontend usam respostas simuladas de banco; não comprovam acesso ao banco da equipe.

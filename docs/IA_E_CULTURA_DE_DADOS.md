# Capítulo — Inteligência Artificial e Cultura de Dados (Big Data)

> Plataforma Digital de Mobilização, Transparência e Arrecadação
> Associação Beneficente Nossa Senhora de Piedade

## 1. Introdução

Organizações não governamentais costumam tomar decisões com base na intuição: qual campanha
divulgar, quais materiais pedir, quando chamar voluntários. A **cultura de dados** propõe outro
caminho: registrar de forma estruturada tudo o que acontece na organização e usar esses
registros para entender o presente e antecipar o futuro.

A **Inteligência Artificial (IA)** é o conjunto de técnicas que permitem a um sistema
computacional aprender padrões a partir de dados e usá-los para classificar, prever ou recomendar.
Neste projeto, a IA não é um recurso decorativo: ela é alimentada pelos dados que a própria
plataforma coleta e devolve informação útil para a equipe da ONG e para os visitantes do site.

## 2. Big Data e os "5 Vs" no contexto da ONG

O termo *Big Data* descreve conjuntos de dados caracterizados pelos **5 Vs**. Uma ONG de porte
local não produz o volume de uma grande empresa, mas os mesmos princípios se aplicam:

| V | Significado | Na plataforma |
|---|---|---|
| **Volume** | Quantidade de dados | Cada doação, inscrição, entrada de material e relatório é gravado. O histórico cresce continuamente. |
| **Velocidade** | Frequência com que os dados chegam | Doações e inscrições entram em tempo real pelo site; o painel reflete tudo imediatamente. |
| **Variedade** | Tipos diferentes de dados | Dados estruturados (valores, datas, quantidades), texto livre (disponibilidade, perguntas do chatbot) e documentos (PDFs). |
| **Veracidade** | Confiabilidade | Validação de CPF/CNPJ, e-mail, datas e valores; chaves estrangeiras e transações garantem consistência (RNF11). |
| **Valor** | Utilidade para decisões | Previsões, alertas e recomendações exibidos no Painel de Insights. |

## 3. Ciclo de vida dos dados na plataforma

1. **Coleta**: formulários do site (doação, cadastro de doador e voluntário) e registros do
   painel (confirmação de pagamento, entrada de materiais, relatórios de impacto).
2. **Armazenamento**: banco relacional MySQL (TiDB Cloud) com tabelas normalizadas
   (`doacoes_financeiras`, `doadores`, `voluntarios`, `escalas_voluntarios`,
   `necessidades_materiais`, `recebimentos_materiais`, `relatorios_impacto` etc.).
   A tabela `recebimentos_materiais` foi criada especificamente para guardar o **histórico**
   de cada entrada, que é o que permite medir o ritmo de arrecadação.
3. **Processamento**: consultas agregadas (somas por mês, contagens por área) e os modelos
   de IA descritos na seção 4.
4. **Visualização**: gráficos e indicadores no painel administrativo e o mural público de
   transparência.
5. **Decisão**: recomendações em linguagem natural orientam ações da equipe (divulgar uma
   campanha, priorizar um item, analisar inscrições pendentes).

## 4. Técnicas de Inteligência Artificial aplicadas

Todas as técnicas foram implementadas **no próprio servidor**, sem serviços pagos, o que
mantém o custo zero e evita enviar dados da ONG para terceiros.

### 4.1 Assistente virtual: Processamento de Linguagem Natural + Naive Bayes

- **Problema:** visitantes fazem as mesmas perguntas (como doar, o que a ONG precisa, onde
  entregar, como ser voluntário), escritas de formas diferentes.
- **Técnica:** aprendizado de máquina **supervisionado** com o classificador **Naive Bayes
  Multinomial** (`src/ia/classificador.js`).
  1. *Pré-processamento (PLN)*: o texto é convertido para minúsculas, sem acentos; palavras
     sem significado (*stopwords*: "de", "para", "que"...) são removidas e as palavras são
     reduzidas ao radical (*stemming*), de modo que "doar", "doação" e "doações" viram o mesmo
     termo (`src/ia/texto.js`).
  2. *Treinamento*: o modelo aprende com frases de exemplo rotuladas em 13 **intenções**
     (doação, PIX, cartão/boleto, doação mensal, materiais, ponto de coleta, voluntariado,
     campanhas, transparência, sobre, contato, saudação e agradecimento).
  3. *Classificação*: para uma pergunta nova, o modelo calcula
     P(intenção | palavras) ∝ P(intenção) × ∏ P(palavra | intenção), com suavização de
     Laplace, e escolhe a intenção mais provável.
  4. *Limiar de confiança*: se a probabilidade for menor que 20%, o assistente admite que não
     entendeu, em vez de dar uma resposta errada.
- **Integração com os dados:** a resposta é montada consultando o banco em tempo real. Por
  exemplo, "o que vocês estão precisando?" retorna os itens com menor percentual arrecadado
  e quanto falta de cada um.
- **Resultado em teste:** 20 de 20 perguntas de validação classificadas corretamente,
  incluindo frases fora do tema (ex.: "qual a capital da França") corretamente recusadas.

### 4.2 Previsão de arrecadação: Regressão Linear

- **Problema:** planejar gastos sem saber quanto será arrecadado.
- **Técnica:** **regressão linear simples** pelo método dos mínimos quadrados
  (`src/ia/insights.js`) sobre o total de doações **confirmadas** por mês (últimos 12 meses):
  - y = a + b·x, em que x é o mês e y o total arrecadado;
  - b (inclinação) indica a **tendência** (alta, queda ou estável, em % ao mês);
  - a previsão do próximo mês é y(n);
  - o **coeficiente de determinação R²** mede a confiabilidade (alta ≥ 0,7; média ≥ 0,4).
- O modelo só é aplicado com pelo menos 3 meses de dados. Abaixo disso, o painel informa
  "dados insuficientes", uma decisão consciente para não exibir previsões sem base estatística.

### 4.3 Alerta de materiais: análise de séries de eventos

- A partir do histórico `recebimentos_materiais`, calcula-se o **ritmo diário** de entrada de
  cada item nos últimos 30 dias e estima-se **em quantos dias** a meta será atingida.
- Itens sem entradas recebem nível **Crítico**; previsões acima de 60 dias, **Atenção**.

### 4.4 Recomendação de voluntários para escalas

Sistema de recomendação baseado em conteúdo (`src/ia/recomendacao.js`). Para uma atividade
(ex.: "Reforço escolar", sábado 9h), cada voluntário aprovado recebe uma nota de 0 a 100:

| Critério | Peso | Técnica |
|---|---|---|
| Afinidade | 50% | **Similaridade de cosseno** entre os termos da atividade e a área de interesse/profissão do voluntário |
| Disponibilidade | 30% | Interpretação do texto livre ("sábados pela manhã", "fins de semana", "dias úteis à noite") comparado ao dia e turno |
| Equilíbrio | 20% | Prioriza quem teve menos horas de escala nos últimos 30 dias (distribuição justa) |

Voluntários com conflito de horário são descartados. Cada sugestão vem com os **motivos**
(explicabilidade), e a decisão final é sempre humana.

### 4.5 Recomendações em linguagem natural

Os indicadores são convertidos em frases objetivas no painel, por exemplo:
"A arrecadação está em queda (−8% ao mês). Vale divulgar uma campanha nas redes sociais" ou
"3 itens sem nenhuma entrada nos últimos 30 dias: Fraldas, Fórmula infantil...".

## 5. Ética, privacidade e LGPD

- **Minimização de dados:** coleta-se apenas o necessário para cada finalidade (RF02, RF08).
- **Separação público × privado:** o assistente virtual e a página de Transparência usam
  somente dados **agregados** (totais, contagens). Nomes, e-mails, telefones e CPF/CNPJ nunca
  são expostos ao público nem usados pelos modelos de previsão.
- **Segurança:** senhas com *hash* bcrypt, comunicação criptografada (HTTPS e TLS com o banco),
  acesso restrito por perfil (RF15, RNF04).
- **Transparência algorítmica:** os modelos são simples e interpretáveis (Naive Bayes,
  regressão linear, cosseno). A recomendação de voluntários mostra os motivos da nota.
- **Humano no controle:** a IA sugere; aprovar voluntários, confirmar pagamentos e montar
  escalas são sempre decisões da equipe.
- **Viés:** o classificador reflete as frases de treino. Perguntas muito diferentes dos
  exemplos podem não ser entendidas, e novas frases podem ser adicionadas em
  `src/ia/assistente.js` para ampliar o vocabulário.

## 6. Limitações e trabalhos futuros

- As previsões ganham precisão conforme o histórico cresce. Com poucos meses de uso, os
  resultados são indicativos.
- O assistente trabalha com intenções pré-definidas. Uma evolução possível é um modelo de
  linguagem de grande porte (LLM), o que implicaria custos e cuidados adicionais com
  privacidade.
- Integração com gateway de pagamento permitiria confirmar doações automaticamente e
  enriquecer a base de dados.
- Painéis com sazonalidade (datas comemorativas como Dia das Crianças e Natal) e segmentação
  de doadores recorrentes.

## 7. Conclusão

A plataforma aplica na prática o ciclo da cultura de dados: coletar com qualidade, armazenar
de forma estruturada, analisar com técnicas de IA e transformar o resultado em decisões. Mesmo
com recursos gratuitos, a ONG passa a ter previsões de arrecadação, alertas de falta de
materiais, apoio à organização de voluntários e um canal de atendimento automatizado,
fortalecendo a transparência e a confiança da comunidade.

## Referências

- DAVENPORT, T. H.; HARRIS, J. G. *Competição Analítica*. Rio de Janeiro: Elsevier, 2007.
- RUSSELL, S.; NORVIG, P. *Inteligência Artificial: uma abordagem moderna*. 4. ed. Rio de Janeiro: GEN LTC, 2022.
- MANNING, C. D.; RAGHAVAN, P.; SCHÜTZE, H. *Introduction to Information Retrieval*. Cambridge University Press, 2008.
- BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais (LGPD).
- TAURION, C. *Big Data*. Rio de Janeiro: Brasport, 2013.

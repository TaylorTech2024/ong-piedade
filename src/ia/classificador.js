// Classificador Naive Bayes Multinomial (aprendizado de máquina supervisionado).
// É treinado com frases de exemplo rotuladas por "intenção" e, depois, calcula
// a probabilidade de uma frase nova pertencer a cada intenção.
const { tokens } = require("./texto");

class ClassificadorNaiveBayes {
  constructor() {
    this.contagemPorClasse = new Map(); // classe -> nº de exemplos
    this.palavrasPorClasse = new Map(); // classe -> Map(palavra -> frequência)
    this.totalPalavrasClasse = new Map();
    this.vocabulario = new Set();
    this.totalExemplos = 0;
  }

  treinar(frase, classe) {
    const t = tokens(frase);
    this.totalExemplos++;
    this.contagemPorClasse.set(classe, (this.contagemPorClasse.get(classe) || 0) + 1);
    if (!this.palavrasPorClasse.has(classe)) this.palavrasPorClasse.set(classe, new Map());
    const freq = this.palavrasPorClasse.get(classe);
    for (const p of t) {
      freq.set(p, (freq.get(p) || 0) + 1);
      this.totalPalavrasClasse.set(classe, (this.totalPalavrasClasse.get(classe) || 0) + 1);
      this.vocabulario.add(p);
    }
  }

  // Retorna { classe, confianca (0-1), conhecidas (nº de palavras que o modelo já viu) }
  classificar(frase) {
    const t = tokens(frase);
    const conhecidas = t.filter((p) => this.vocabulario.has(p));
    if (conhecidas.length === 0) return { classe: null, confianca: 0, conhecidas: 0 };

    const V = this.vocabulario.size;
    const logs = [];
    for (const [classe, qtd] of this.contagemPorClasse) {
      const freq = this.palavrasPorClasse.get(classe);
      const total = this.totalPalavrasClasse.get(classe) || 0;
      let log = Math.log(qtd / this.totalExemplos); // probabilidade a priori
      for (const p of conhecidas) log += Math.log(((freq.get(p) || 0) + 1) / (total + V)); // suavização de Laplace
      logs.push([classe, log]);
    }
    // Converte log-probabilidades em probabilidades (softmax).
    const max = Math.max(...logs.map(([, l]) => l));
    const exps = logs.map(([c, l]) => [c, Math.exp(l - max)]);
    const soma = exps.reduce((s, [, e]) => s + e, 0);
    exps.sort((a, b) => b[1] - a[1]);
    return { classe: exps[0][0], confianca: exps[0][1] / soma, conhecidas: conhecidas.length };
  }
}

module.exports = { ClassificadorNaiveBayes };

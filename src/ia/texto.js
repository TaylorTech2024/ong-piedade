// Pré-processamento de texto em português (Processamento de Linguagem Natural):
// minúsculas, remoção de acentos, de palavras vazias (stopwords) e redução
// das palavras ao radical (stemming simplificado), para que "doar", "doação"
// e "doações" sejam tratadas como a mesma palavra.

const STOPWORDS = new Set(
  ("a o as os um uma uns umas de do da dos das no na nos nas em por para pra pro com sem " +
    "e ou que se me te lhe eu voce voces vc ele ela eles elas nos meu minha seu sua isso isto " +
    "esse essa este esta aquele aquela ai la aqui ja mais muito pouco tambem so ser estar " +
    "ter tem tenho era foi sao sou esta estao ao aos pelo pela pelos pelas qual quais " +
    "como quando porque q favor gostaria queria quero posso pode").split(" ")
);

// Sufixos mais comuns, do maior para o menor.
const SUFIXOS = [
  "amentos", "imentos", "amento", "imento", "adoras", "adores", "acoes", "icoes", "mente", "idade",
  "adora", "ador", "acao", "icao", "ante", "ando", "endo", "indo", "aram", "eram", "iram",
  "avam", "ivel", "avel", "oes", "aes", "ais", "eis", "ois", "ar", "er", "ir", "as", "es", "is", "os", "us", "a", "e", "o", "s",
];

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function radical(palavra) {
  if (palavra.length <= 3) return palavra;
  for (const s of SUFIXOS) {
    if (palavra.endsWith(s) && palavra.length - s.length >= 3) return palavra.slice(0, -s.length);
  }
  return palavra;
}

// "Quero doar fraldas!" -> ["doa", "fald"]
function tokens(texto) {
  return normalizar(texto)
    .split(/\s+/)
    .filter((p) => p.length > 1 && !STOPWORDS.has(p))
    .map(radical);
}

module.exports = { normalizar, tokens };

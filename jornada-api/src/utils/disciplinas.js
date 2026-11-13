// Disciplinas aceitas na inscrição e o formato de apresentação de cada uma.
const DISCIPLINAS = [
  'APIExt I',
  'APIExt II',
  'APIExt III',
  'APIExt IV',
  'APIExt V',
  'APIExt VI',
  'PIC',
  'Outras',
];

const FORMATOS = ['banner', 'comunicacao_oral'];

// Formato definido pelo servidor. PIC e Outras não aparecem aqui: o aluno escolhe.
const FORMATO_AUTOMATICO = {
  'APIExt I': 'banner',
  'APIExt II': 'comunicacao_oral',
  'APIExt III': 'banner',
  'APIExt IV': 'comunicacao_oral',
  'APIExt V': 'banner',
  'APIExt VI': 'comunicacao_oral',
};

// Aceita "banner", "Comunicação oral", "comunicacao-oral" etc. e devolve o valor canônico
// ('banner' | 'comunicacao_oral'). Texto desconhecido volta normalizado; vazio/ausente volta ''.
function normalizarFormato(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

module.exports = { DISCIPLINAS, FORMATOS, FORMATO_AUTOMATICO, normalizarFormato };

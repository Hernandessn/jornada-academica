// Testes das funções puras (sem banco nem servidor).
const { cpfValido, mascararCpf, normalizarTelefone } = require('../src/utils/cpf');
const { estaElegivel, percentualDe, arredondar2 } = require('../src/utils/elegibilidade');
const { hojeSaoPaulo, dataValida, somarDias, formatarDataBr } = require('../src/utils/datas');
const { normalizarFormato, DISCIPLINAS, FORMATO_AUTOMATICO } = require('../src/utils/disciplinas');
const { motivoInscricoesFechadas, certificadosLiberados } = require('../src/servicos/periodos');

describe('CPF e telefone', () => {
  test('valida os dígitos verificadores, com ou sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
    expect(cpfValido('abc')).toBe(false);
  });

  test('mascara o CPF e normaliza o telefone', () => {
    expect(mascararCpf('52998224725')).toBe('***.982.247-**');
    expect(normalizarTelefone('+55 (86) 99999-1234')).toBe('86999991234');
    expect(normalizarTelefone('(86) 3222-1234')).toBe('8632221234');
  });
});

describe('Elegibilidade (RN02)', () => {
  const horas = (valor) => ({ modo_aprovacao: 'horas', valor_minimo: valor });
  const percentual = (valor) => ({ modo_aprovacao: 'percentual', valor_minimo: valor });

  test('modo horas', () => {
    expect(estaElegivel(20, 20, horas(20))).toBe(true);
    expect(estaElegivel(19.5, 20, horas(20))).toBe(false);
    expect(estaElegivel(0, 20, horas(20))).toBe(false);
  });

  test('modo percentual sobre a carga total das 4 sessões (11,5 h)', () => {
    expect(estaElegivel(6, 11.5, percentual(50))).toBe(true); // 52,17%
    expect(estaElegivel(6, 11.5, percentual(75))).toBe(false);
    expect(estaElegivel(8.625, 11.5, percentual(75))).toBe(true); // exatamente 75%
    expect(estaElegivel(8.5, 11.5, percentual(75))).toBe(false);
    expect(estaElegivel(11.5, 11.5, percentual(75))).toBe(true);
  });

  test('sem presença ou sem carga total ninguém é elegível', () => {
    expect(estaElegivel(0, 11.5, percentual(75))).toBe(false);
    expect(estaElegivel(5, 0, percentual(75))).toBe(false);
  });

  test('arredondamento do percentual', () => {
    expect(arredondar2(percentualDe(6, 11.5))).toBe(52.17);
    expect(arredondar2(percentualDe(2, 11.5))).toBe(17.39);
    expect(arredondar2(percentualDe(9.5, 11.5))).toBe(82.61);
  });
});

describe('Datas (fuso de São Paulo)', () => {
  test('hojeSaoPaulo usa o horário de Brasília, não o UTC', () => {
    expect(hojeSaoPaulo(new Date('2026-12-14T02:30:00Z'))).toBe('2026-12-13'); // 23h30 do dia 13 em SP
    expect(hojeSaoPaulo(new Date('2026-12-14T03:00:00Z'))).toBe('2026-12-14'); // meia-noite em SP
    expect(hojeSaoPaulo(new Date('2026-11-16T15:00:00Z'))).toBe('2026-11-16');
  });

  test('dataValida só aceita datas reais AAAA-MM-DD', () => {
    expect(dataValida('2026-12-14')).toBe(true);
    expect(dataValida('2028-02-29')).toBe(true);
    expect(dataValida('2026-02-29')).toBe(false);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('14/12/2026')).toBe(false);
    expect(dataValida(20261214)).toBe(false);
    expect(dataValida('')).toBe(false);
  });

  test('somarDias e formatarDataBr', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-12-01', -1)).toBe('2026-11-30');
    expect(formatarDataBr('2026-11-16')).toBe('16/11/2026');
  });
});

describe('Disciplinas e formato', () => {
  test('lista de disciplinas e formatos automáticos', () => {
    expect(DISCIPLINAS).toEqual([
      'APIExt I', 'APIExt II', 'APIExt III', 'APIExt IV', 'APIExt V', 'APIExt VI', 'PIC', 'Outras',
    ]);
    expect(FORMATO_AUTOMATICO['APIExt I']).toBe('banner');
    expect(FORMATO_AUTOMATICO['APIExt VI']).toBe('comunicacao_oral');
    expect(FORMATO_AUTOMATICO.PIC).toBeUndefined();
    expect(FORMATO_AUTOMATICO.Outras).toBeUndefined();
  });

  test('normalizarFormato', () => {
    expect(normalizarFormato('banner')).toBe('banner');
    expect(normalizarFormato(' Banner ')).toBe('banner');
    expect(normalizarFormato('Comunicação oral')).toBe('comunicacao_oral');
    expect(normalizarFormato('comunicacao-oral')).toBe('comunicacao_oral');
    expect(normalizarFormato('')).toBe('');
    expect(normalizarFormato(null)).toBe('');
    expect(normalizarFormato(123)).toBe('');
  });
});

describe('Período de inscrições e liberação dos certificados', () => {
  const config = {
    inscricoes_de: '2026-11-16',
    inscricoes_ate: '2026-11-30',
    certificados_a_partir_de: '2026-12-14',
    ignorar_datas: false,
  };

  test('inscrições: fechadas antes e depois, abertas nos extremos', () => {
    expect(motivoInscricoesFechadas(config, '2026-11-15')).toMatch(/ainda não começaram.*16\/11\/2026/);
    expect(motivoInscricoesFechadas(config, '2026-11-16')).toBeNull();
    expect(motivoInscricoesFechadas(config, '2026-11-20')).toBeNull();
    expect(motivoInscricoesFechadas(config, '2026-11-30')).toBeNull();
    expect(motivoInscricoesFechadas(config, '2026-12-01')).toMatch(/encerradas.*30\/11\/2026/);
  });

  test('ignorar_datas libera as inscrições a qualquer hora', () => {
    const livre = { ...config, ignorar_datas: true };
    expect(motivoInscricoesFechadas(livre, '2026-01-01')).toBeNull();
    expect(motivoInscricoesFechadas(livre, '2027-01-01')).toBeNull();
  });

  test('certificados: liberados a partir da data (inclusive) ou com ignorar_datas', () => {
    expect(certificadosLiberados(config, '2026-12-13')).toBe(false);
    expect(certificadosLiberados(config, '2026-12-14')).toBe(true);
    expect(certificadosLiberados(config, '2027-01-10')).toBe(true);
    expect(certificadosLiberados({ ...config, ignorar_datas: true }, '2026-11-01')).toBe(true);
  });
});

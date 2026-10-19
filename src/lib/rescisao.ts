export type Motivo =
  | "termino"
  | "sem_justa_causa"
  | "pedido"
  | "desempenho"
  | "justa_causa";

export const MOTIVOS: Record<Motivo, string> = {
  termino: "Término do contrato (prazo final)",
  sem_justa_causa: "Dispensa antecipada sem justa causa",
  pedido: "Pedido de demissão do aprendiz",
  desempenho: "Desempenho insuficiente / ausência escolar",
  justa_causa: "Falta disciplinar grave (justa causa)",
};

export interface Entrada {
  salario: number;
  admissao: string; // yyyy-mm-dd
  desligamento: string;
  terminoPrevisto: string;
  motivo: Motivo;
  feriasVencidas: boolean;
  saldoFgts?: number | undefined;
  /** 13º já recebido em folha no ano do desligamento (adiantamento) */
  adiantamento13?: number | undefined;
}

export interface Linha {
  label: string;
  valor: number;
  /** Memória de cálculo: de onde veio o valor, passo a passo */
  detalhe: string;
  /** Fundamento legal resumido */
  baseLegal: string;
}

export interface Resultado {
  linhas: Linha[];
  total: number;
  fgtsSaque: boolean;
  saldoFgts: number;
  fgtsDetalhe: string;
}

const d = (s: string) => {
  const [y = 0, m = 1, dd = 1] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const mesAno = (dt: Date) =>
  `${MESES_PT[dt.getUTCMonth()]}/${dt.getUTCFullYear()}`;
const dataBr = (s: string) => {
  const [y, m, dd] = s.split("-");
  return `${dd}/${m}/${y}`;
};

/** Meses completos entre datas; fração >= 15 dias conta como mês. */
export function mesesAvos(inicio: Date, fim: Date): number {
  let meses =
    (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
    (fim.getUTCMonth() - inicio.getUTCMonth());
  let resto = fim.getUTCDate() - inicio.getUTCDate() + 1;
  if (resto < 0) {
    meses -= 1;
    const diasMesAnt = new Date(
      Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), 0)
    ).getUTCDate();
    resto += diasMesAnt;
  }
  if (resto >= 30) {
    meses += 1;
    resto -= 30;
  }
  return Math.max(0, meses + (resto >= 15 ? 1 : 0));
}

export function calcular(e: Entrada): Resultado {
  const adm = d(e.admissao);
  const des = d(e.desligamento);
  const term = d(e.terminoPrevisto);
  const s = e.salario;
  const linhas: Linha[] = [];
  const justa = e.motivo === "justa_causa";

  // 1) Saldo de salário
  const diasTrabalhados = Math.min(des.getUTCDate(), 30);
  const valorDia = s / 30;
  const saldoSalario = r2(valorDia * diasTrabalhados);
  linhas.push({
    label: `Saldo de salário (${diasTrabalhados} dias)`,
    valor: saldoSalario,
    detalhe:
      `${BRL(s)} ÷ 30 dias = ${BRL(r2(valorDia))} por dia × ` +
      `${diasTrabalhados} dias trabalhados em ${mesAno(des)} = ${BRL(saldoSalario)}.`,
    baseLegal:
      "Salário proporcional aos dias trabalhados no mês do desligamento (contrato de aprendizagem — CLT, arts. 428 a 433).",
  });

  // 2) 13º salário proporcional
  const inicioAno = new Date(Date.UTC(des.getUTCFullYear(), 0, 1));
  const meses13 = Math.min(12, mesesAvos(adm > inicioAno ? adm : inicioAno, des));
  if (!justa) {
    const valorAvo = s / 12;
    const bruto13 = r2(valorAvo * meses13);
    const adiant =
      e.adiantamento13 && e.adiantamento13 > 0 ? r2(e.adiantamento13) : 0;
    const valor13 = Math.max(0, r2(bruto13 - adiant));
    linhas.push({
      label: `13º salário proporcional (${meses13}/12)`,
      valor: valor13,
      detalhe:
        `${BRL(s)} ÷ 12 = ${BRL(r2(valorAvo))} por avo × ${meses13} ` +
        `${meses13 === 1 ? "avo" : "avos"} trabalhados em ${des.getUTCFullYear()} ` +
        `(fração igual ou superior a 15 dias conta como mês cheio) = ${BRL(bruto13)}` +
        (adiant > 0
          ? ` − ${BRL(adiant)} já recebidos em folha = ${BRL(valor13)}.`
          : "."),
      baseLegal:
        "Lei nº 4.090/1962 — 13º salário proporcional aos meses trabalhados no ano do desligamento.",
    });
  }

  const totalMeses = mesesAvos(adm, des);

  // 3) Férias vencidas (indenizadas — não gozadas)
  if (e.feriasVencidas) {
    linhas.push({
      label: "Férias vencidas (não gozadas)",
      valor: r2(s),
      detalhe:
        `1 salário integral (${BRL(s)}): período aquisitivo de 12 meses já completado ` +
        `e férias não gozadas — pagas de forma indenizada na rescisão.`,
      baseLegal:
        "CLT, arts. 129 a 153 — férias vencidas não gozadas são indenizadas na rescisão.",
    });
    linhas.push({
      label: "1/3 sobre férias vencidas",
      valor: r2(s / 3),
      detalhe: `${BRL(s)} ÷ 3 = ${BRL(r2(s / 3))}.`,
      baseLegal:
        "Art. 7º, XVII, da Constituição Federal — adicional de 1/3 sobre as férias.",
    });
  }

  // 4) Férias proporcionais (indenizadas — o aprendiz não goza)
  const mesesFerias =
    totalMeses % 12 === 0 && totalMeses > 0 && !e.feriasVencidas
      ? 12
      : totalMeses % 12;
  if (!justa && mesesFerias > 0) {
    const fp = r2((s / 12) * mesesFerias);
    const terco = r2(fp / 3);
    linhas.push({
      label: `Férias proporcionais (${mesesFerias}/12)`,
      valor: fp,
      detalhe:
        `${BRL(s)} ÷ 12 = ${BRL(r2(s / 12))} por avo × ${mesesFerias} ` +
        `${mesesFerias === 1 ? "avo" : "avos"} do período aquisitivo atual = ${BRL(fp)}. ` +
        `Como o contrato se encerra, as férias são indenizadas (não gozadas).`,
      baseLegal:
        "CLT, art. 146 — férias proporcionais + 1/3 na rescisão (exceto na justa causa).",
    });
    linhas.push({
      label: "1/3 sobre férias proporcionais",
      valor: terco,
      detalhe: `${BRL(fp)} ÷ 3 = ${BRL(terco)}.`,
      baseLegal:
        "Art. 7º, XVII, da Constituição Federal — adicional de 1/3 sobre as férias.",
    });
  }

  // 5) FGTS — informativo: 2% ao mês, SEM multa de 40%
  const saldoFgts =
    e.saldoFgts && e.saldoFgts > 0 ? r2(e.saldoFgts) : r2(s * 0.02 * totalMeses);
  const fgtsSaque = e.motivo === "termino" || e.motivo === "sem_justa_causa";
  const fgtsDetalhe =
    (e.saldoFgts && e.saldoFgts > 0
      ? `Saldo informado: ${BRL(saldoFgts)}.`
      : `Estimativa dos depósitos: ${BRL(s)} × 2% × ${totalMeses} meses = ${BRL(saldoFgts)} ` +
        `(considere informar o saldo real do extrato).`) +
    ` O FGTS do aprendiz é de 2% ao mês (art. 15, § 7º, da Lei nº 8.036/1990) e ` +
    `NÃO tem multa de 40% — nem no término, nem na dispensa antecipada. ` +
    (fgtsSaque
      ? "Neste motivo de desligamento, o saldo pode ser sacado após a rescisão."
      : "Neste motivo de desligamento, o saldo permanece na conta vinculada.");

  // 6) Indenização do art. 479 — só na dispensa antecipada sem justa causa
  if (e.motivo === "sem_justa_causa") {
    const restantes = Math.max(
      0,
      Math.round((term.getTime() - des.getTime()) / 86400000)
    );
    const inden = r2(((s / 30) * restantes) / 2);
    linhas.push({
      label: "Indenização art. 479 CLT (metade do restante)",
      valor: inden,
      detalhe:
        `Dias restantes até o término previsto (${dataBr(e.terminoPrevisto)}): ` +
        `${restantes} dias × ${BRL(s)} ÷ 30 ÷ 2 = ${BRL(inden)} — ` +
        `metade da remuneração a que o aprendiz teria direito até o fim do contrato.`,
      baseLegal:
        "Art. 479 da CLT — indenização devida na rescisão antecipada sem justa causa do contrato por prazo determinado.",
    });
  }

  const total = r2(linhas.reduce((a, l) => a + l.valor, 0));
  return { linhas, total, fgtsSaque, saldoFgts, fgtsDetalhe };
}

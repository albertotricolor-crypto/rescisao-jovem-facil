import { describe, it, expect } from "vitest";
import { calcular, mesesAvos } from "@/lib/rescisao";

const base = {
  salario: 1200,
  admissao: "2025-03-01",
  desligamento: "2026-02-28",
  terminoPrevisto: "2026-02-28",
  feriasVencidas: false,
} as const;

const motivos = ["termino", "sem_justa_causa", "pedido", "desempenho", "justa_causa"] as const;

describe("rescisão aprendiz — Lei de Aprendizagem", () => {
  it("nenhum motivo tem multa de 40% do FGTS", () => {
    for (const motivo of motivos) {
      const r = calcular({ ...base, motivo });
      expect(r.linhas.some((l) => l.label.includes("40%"))).toBe(false);
      expect(r.fgtsDetalhe).toContain("NÃO tem multa de 40%");
    }
  });

  it("término de contrato de 12 meses: saldo + 13º 2/12 + férias 12/12 + 1/3", () => {
    const r = calcular({ ...base, motivo: "termino" });
    expect(r.linhas[0].valor).toBe(1120); // 1200/30*28
    expect(r.linhas.find((l) => l.label.includes("13º"))?.valor).toBe(200); // 1200/12*2
    expect(r.linhas.find((l) => l.label.includes("proporcionais (12/12)"))?.valor).toBe(1200);
    expect(r.linhas.find((l) => l.label.includes("1/3 sobre férias proporcionais"))?.valor).toBe(400);
    expect(r.total).toBe(1120 + 200 + 1200 + 400);
    expect(r.fgtsSaque).toBe(true);
  });

  it("FGTS do aprendiz é 2% ao mês", () => {
    const r = calcular({ ...base, motivo: "termino" });
    expect(r.saldoFgts).toBe(288); // 1200*0.02*12
  });

  it("dispensa sem justa causa tem indenização do art. 479 e saque do FGTS", () => {
    const r = calcular({ ...base, motivo: "sem_justa_causa", terminoPrevisto: "2026-05-29", saldoFgts: 100 });
    const inden = r.linhas.find((l) => l.label.includes("479"));
    expect(inden?.valor).toBe(1800); // 1200/30*90/2
    expect(r.fgtsSaque).toBe(true);
    expect(r.saldoFgts).toBe(100);
  });

  it("justa causa: só saldo de salário, sem 13º e sem férias proporcionais", () => {
    const r = calcular({ ...base, motivo: "justa_causa" });
    expect(r.linhas.length).toBe(1);
    expect(r.fgtsSaque).toBe(false);
  });

  it("adiantamento de 13º abate do 13º proporcional", () => {
    const r = calcular({ ...base, motivo: "termino", adiantamento13: 200 });
    expect(r.linhas.find((l) => l.label.includes("13º"))?.valor).toBe(0);
  });

  it("todas as linhas trazem memória de cálculo e base legal", () => {
    const r = calcular({ ...base, motivo: "termino" });
    for (const l of r.linhas) {
      expect(l.detalhe.length).toBeGreaterThan(10);
      expect(l.baseLegal.length).toBeGreaterThan(10);
    }
    expect(r.fgtsDetalhe).toContain("2%");
  });

  it("mesesAvos: fração >= 15 dias conta como mês", () => {
    const d = (s: string) => {
      const [y, m, dd] = s.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, dd));
    };
    expect(mesesAvos(d("2026-01-01"), d("2026-02-14"))).toBe(1);
    expect(mesesAvos(d("2026-01-01"), d("2026-02-15"))).toBe(2);
  });
});

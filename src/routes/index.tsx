import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { calcular, MOTIVOS, type Motivo, type Resultado } from "@/lib/rescisao";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calculadora de Rescisão do Jovem Aprendiz" },
      { name: "description", content: "Calcule a rescisão do contrato de aprendizagem: saldo de salário, 13º proporcional, férias + 1/3 e FGTS de 2% — sem multa de 40%. Com memória de cálculo completa." },
      { property: "og:title", content: "Calculadora de Rescisão do Jovem Aprendiz" },
      { property: "og:description", content: "Simule verbas rescisórias do jovem aprendiz conforme a Lei de Aprendizagem, com explicação de cada valor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Index() {
  const [nome, setNome] = useState("");
  const [salario, setSalario] = useState("1518");
  const [admissao, setAdmissao] = useState("2025-03-01");
  const [desligamento, setDesligamento] = useState("2026-10-19");
  const [termino, setTermino] = useState("2027-02-28");
  const [motivo, setMotivo] = useState<Motivo>("termino");
  const [vencidas, setVencidas] = useState(false);
  const [fgts, setFgts] = useState("");
  const [adiant13, setAdiant13] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");

  function onCalcular() {
    const s = parseFloat(salario.replace(",", "."));
    if (!s || s <= 0) {
      setErro("Informe um salário mensal válido.");
      setRes(null);
      return;
    }
    if (!admissao || !desligamento || !termino) {
      setErro("Preencha todas as datas.");
      setRes(null);
      return;
    }
    if (desligamento < admissao) {
      setErro("A data do desligamento não pode ser anterior à admissão.");
      setRes(null);
      return;
    }
    setErro("");
    setRes(
      calcular({
        salario: s,
        admissao,
        desligamento,
        terminoPrevisto: termino,
        motivo,
        feriasVencidas: vencidas,
        saldoFgts: parseFloat(fgts.replace(",", ".")) || undefined,
        adiantamento13: parseFloat(adiant13.replace(",", ".")) || undefined,
      })
    );
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Contrato de aprendizagem · CLT</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl text-foreground">Rescisão do Jovem Aprendiz</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">Preencha os dados, clique em calcular e acompanhe a explicação completa de cada valor.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="panel space-y-4 print:hidden">
            <Field label="Nome do aprendiz (opcional)"><input className="field" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Para identificar a simulação" /></Field>
            <Field label="Salário mensal (R$)"><input className="field" inputMode="decimal" value={salario} onChange={(e) => setSalario(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data de admissão"><input type="date" className="field" value={admissao} onChange={(e) => setAdmissao(e.target.value)} /></Field>
              <Field label="Data do desligamento"><input type="date" className="field" value={desligamento} onChange={(e) => setDesligamento(e.target.value)} /></Field>
            </div>
            <Field label="Término previsto do contrato"><input type="date" className="field" value={termino} onChange={(e) => setTermino(e.target.value)} /></Field>
            <Field label="Motivo do desligamento">
              <select className="field" value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
                {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="13º já recebido este ano (R$ — opcional)"><input className="field" inputMode="decimal" value={adiant13} onChange={(e) => setAdiant13(e.target.value)} placeholder="0,00" /></Field>
            <Field label="Saldo do FGTS (opcional — senão estimamos 2%/mês)"><input className="field" inputMode="decimal" value={fgts} onChange={(e) => setFgts(e.target.value)} placeholder="0,00" /></Field>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="accent-primary h-4 w-4" checked={vencidas} onChange={(e) => setVencidas(e.target.checked)} />
              Possui férias vencidas não gozadas
            </label>
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
            <button
              type="button"
              onClick={onCalcular}
              className="w-full rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Calcular rescisão
            </button>
          </section>

          <section className="panel-accent" id="resultado">
            <h2 className="font-display text-2xl">Resultado</h2>
            {!res ? (
              <p className="mt-4 opacity-80">Preencha os dados e clique em “Calcular rescisão” para ver o resultado com a explicação completa.</p>
            ) : (
              <>
                {nome.trim() && <p className="mt-2 text-sm opacity-80">Aprendiz: <span className="font-semibold">{nome.trim()}</span> · {MOTIVOS[motivo]}</p>}
                <ul className="mt-4 divide-y divide-primary-foreground/20">
                  {res.linhas.map((l) => (
                    <li key={l.label} className="py-3">
                      <div className="flex justify-between gap-4 text-sm">
                        <span>{l.label}</span>
                        <span className="font-mono font-semibold">{brl(l.valor)}</span>
                      </div>
                      <details className="mt-1 text-xs opacity-90">
                        <summary className="cursor-pointer underline underline-offset-2">Como foi calculado</summary>
                        <p className="mt-1">{l.detalhe}</p>
                        <p className="mt-1 italic">{l.baseLegal}</p>
                      </details>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-end justify-between border-t-2 border-primary-foreground/40 pt-4">
                  <span className="text-sm uppercase tracking-wider">Total a receber</span>
                  <span className="font-display text-3xl">{brl(res.total)}</span>
                </div>
                <div className="mt-4 rounded-md bg-primary-foreground/10 p-3 text-sm">
                  <p className="font-semibold">FGTS ({brl(res.saldoFgts)}): {res.fgtsSaque ? "pode ser sacado." : "não pode ser sacado neste motivo."}</p>
                  <p className="mt-1 text-xs opacity-90">{res.fgtsDetalhe}</p>
                </div>
                <div className="mt-4 flex gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 rounded-md border border-primary-foreground/40 px-4 py-2 text-sm font-semibold transition hover:bg-primary-foreground/10"
                  >
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={() => setRes(null)}
                    className="flex-1 rounded-md border border-primary-foreground/40 px-4 py-2 text-sm font-semibold transition hover:bg-primary-foreground/10"
                  >
                    Nova simulação
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Simulação estimativa conforme a Lei de Aprendizagem (CLT, arts. 428–433; Lei nº 10.097/2000), Lei nº 4.090/1962 (13º),
          art. 15, § 7º da Lei nº 8.036/1990 (FGTS de 2%) e art. 479 da CLT (indenização). O jovem aprendiz <strong>não tem direito à multa de 40% do FGTS</strong>.
          Não inclui descontos de INSS/IRRF nem convenções coletivas. Confirme com o RH ou um contador.
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-foreground">{label}</span>{children}</label>;
}

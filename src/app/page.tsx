import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  ChefHat,
  MessageCircleMore,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Table2,
  Truck,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const featureCards = [
  {
    icon: ShoppingCart,
    title: "PDV e atendimento",
    text: "Balcao, comandas, mesas abertas e fechamento no mesmo fluxo, sem gambiarra entre telas.",
  },
  {
    icon: Table2,
    title: "Mesas e consumo",
    text: "Abra mesa, lance mais itens depois, gere conta e finalize no caixa com historico claro.",
  },
  {
    icon: Truck,
    title: "Delivery proprio",
    text: "Pedido proprio com taxa, cliente, status, checkout guiado e operacao separada do salao.",
  },
  {
    icon: ChefHat,
    title: "Cozinha",
    text: "Fila por status, tempo medio, pedidos mais antigos e passagem simples entre preparo e pronto.",
  },
  {
    icon: PackageCheck,
    title: "Estoque e validade",
    text: "Recebimento, lotes, FEFO, baixa automatica por ficha tecnica e menos desperdicio na cozinha.",
  },
  {
    icon: BarChart3,
    title: "CMV e relatorios",
    text: "Faturamento, ticket, perdas e custo por produto para decidir com numero e nao no feeling.",
  },
  {
    icon: ReceiptText,
    title: "Fiscal por API",
    text: "Estrutura pronta para NFC-e com provedor externo, sem travar o caixa manual do v1.",
  },
  {
    icon: MessageCircleMore,
    title: "WhatsApp guiado",
    text: "Status de pedido, comunicacao utilitaria e base pronta para add-ons de automacao depois.",
  },
];

const functionBands = [
  {
    eyebrow: "Operacao",
    title: "Do pedido ate a conta sem resquicio entre telas",
    text: "O Sabore nasceu para o restaurante que quer parar de se adaptar ao sistema. Atendimento, mesas, balcao e delivery seguem a logica real da casa.",
    bullets: [
      "Atendimento para relancar itens em mesas ja abertas",
      "Mesas livres, em consumo e em fechamento",
      "Delivery separado da operacao do salao",
    ],
  },
  {
    eyebrow: "Cozinha e estoque",
    title: "Controle de producao e insumo no mesmo produto",
    text: "Nao adianta vender mais e perder na cozinha. A estrutura do Sabore conecta pedido, ficha tecnica, baixa de estoque, validade e divergencia.",
    bullets: [
      "Baixa automatica por receita",
      "Lotes por fornecedor, data e validade",
      "Alertas de minimo e itens proximos do vencimento",
    ],
  },
  {
    eyebrow: "Crescimento",
    title: "Base pronta para fiscal, pagamento e WhatsApp sem misturar tudo",
    text: "As integracoes ja foram pensadas como providers separados. Isso deixa o produto mais escalavel e abre espaco para modulos pagos depois.",
    bullets: [
      "NFC-e por adapter",
      "Checkout online sem TEF no v1",
      "WhatsApp e campanhas como extensao comercial",
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f7f3_0%,#eef3ee_48%,#f8fafc_100%)] text-foreground">
      <section className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-sm font-semibold">Sabore</p>
              <p className="text-xs text-muted-foreground">
                PDV inteligente para restaurantes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button>Entrar no app</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-18">
          <div className="relative">
            <div className="absolute -left-16 top-6 h-40 w-40 rounded-full bg-[rgba(217,111,63,0.12)] blur-3xl" />
            <div className="absolute left-28 top-40 h-52 w-52 rounded-full bg-[rgba(34,112,82,0.12)] blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">SaaS local para Maceio</Badge>
                <Badge variant="neutral">PDV + cozinha + estoque</Badge>
                <Badge variant="warning">{formatCurrency(69.9)}/mes por unidade</Badge>
              </div>
              <h1 className="mt-5 max-w-[12ch] text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                Mais controle na operacao. Menos perda na cozinha.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                O Sabore e um sistema para restaurantes, pizzarias e lanchonetes que
                precisam vender, produzir, controlar insumo e entender CMV sem cair
                num software pesado demais para a rotina.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/app">
                  <Button className="h-11 px-5 text-sm">
                    Ver demonstracao
                    <ArrowRight />
                  </Button>
                </Link>
                <a href="#funcoes">
                  <Button variant="outline" className="h-11 px-5 text-sm">
                    Entender funcoes
                  </Button>
                </a>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[28px] border border-[rgba(18,45,34,0.12)] bg-white/78 p-3 shadow-[0_35px_80px_-55px_rgba(15,23,42,0.5)] backdrop-blur">
              <Image
                src="/sabore-preview.png"
                alt="Preview do painel Sabore"
                width={1280}
                height={900}
                className="w-full rounded-[22px] border border-border object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-white/60" id="funcoes">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-12 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase text-primary">O que cada funcao resolve</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Produto modular, mas pensado como uma operacao unica
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Em vez de vender um monte de tela solta, o Sabore conecta atendimento,
              producao, estoque, fiscal e comunicacao como partes do mesmo fluxo.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="h-full bg-white/90">
                <CardHeader>
                  <span className="flex size-11 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <CardTitle className="pt-3">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-5 py-12 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {functionBands.map((band) => (
            <section
              key={band.title}
              className="rounded-[20px] border border-border bg-white/82 p-6 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.45)]"
            >
              <p className="text-xs font-medium uppercase text-primary">{band.eyebrow}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">{band.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{band.text}</p>
              <div className="mt-5 space-y-2">
                {band.bullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="rounded-md border border-border/80 bg-background/80 px-3 py-3 text-sm"
                  >
                    {bullet}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="border-t border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.35),rgba(232,241,236,0.9))]">
        <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-medium uppercase text-primary">Demo de pizzaria</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Cardapio real para demonstrar o fluxo certo
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Trocamos os itens fake por uma pizzaria de exemplo: pizza media, grande
              e familia, ate 2 sabores na mesma pizza, borda, extras e bebidas com
              volume no proprio nome do produto.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Pizza ate 2 sabores com preco dinamico",
              "Borda catupiry e cheddar com acrescimo por tamanho",
              "Extras como bacon, catupiry e cebola caramelizada",
              "Refrigerantes em 350 ml, 600 ml, 1 litro e 2 litros",
              "Sucos 500 ml e 1 litro ja no cardapio",
              "Itens entram na cozinha e no caixa com valor correto",
            ].map((line) => (
              <div
                key={line}
                className="rounded-md border border-border bg-white/88 px-4 py-4 text-sm"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

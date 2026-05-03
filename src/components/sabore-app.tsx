"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ChefHat,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  MessageCircle,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  ShoppingCart,
  Store,
  Table2,
  Timer,
  Truck,
  Utensils,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  calculateKitchenCounts,
  calculateOrderTotals,
  calculateRecipeCost,
  calculateStockPositions,
  closeCashSession,
  getItemLabel,
  nextOrderStatus,
  reserveStockForOrder,
} from "@/lib/operations";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type {
  CashSession,
  InventoryLot,
  InventoryMovement,
  Order,
  OrderStatus,
  PaymentMethod,
  SaboreData,
  SalesChannel,
} from "@/lib/types";

type View =
  | "overview"
  | "pos"
  | "kitchen"
  | "stock"
  | "reports"
  | "integrations";

const statusLabel: Record<OrderStatus, string> = {
  new: "Novo",
  preparing: "Em preparo",
  ready: "Pronto",
  delivered: "Entregue",
  paid: "Pago",
  cancelled: "Cancelado",
};

const channelLabel: Record<SalesChannel, string> = {
  counter: "Balcao",
  table: "Mesa",
  delivery: "Delivery",
};

const paymentLabel: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  credit: "Credito",
  debit: "Debito",
  voucher: "Voucher",
  online: "Online",
};

const now = "2026-05-03T12:10:00-03:00";
const baseDate = new Date(now);

const navItems: Array<{
  id: View;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "Painel", icon: Store },
  { id: "pos", label: "PDV", icon: ShoppingCart },
  { id: "kitchen", label: "Cozinha", icon: ChefHat },
  { id: "stock", label: "Estoque", icon: PackageCheck },
  { id: "reports", label: "Relatorios", icon: BarChart3 },
  { id: "integrations", label: "Integracoes", icon: ReceiptText },
];

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function orderStatusVariant(status: OrderStatus) {
  if (status === "paid" || status === "delivered") return "success";
  if (status === "ready") return "info";
  if (status === "preparing") return "warning";
  if (status === "cancelled") return "danger";

  return "neutral";
}

function channelIcon(channel: SalesChannel) {
  if (channel === "table") return Table2;
  if (channel === "delivery") return Truck;

  return Store;
}

function deductLotsByMovements(
  lots: InventoryLot[],
  movements: InventoryMovement[],
) {
  const nextLots = cloneData(lots);

  for (const movement of movements) {
    if (movement.quantity >= 0) continue;

    let remaining = Math.abs(movement.quantity);
    const matchingLots = nextLots
      .filter((lot) => lot.ingredientId === movement.ingredientId)
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

    for (const lot of matchingLots) {
      if (remaining <= 0) break;

      const consumed = Math.min(lot.quantity, remaining);
      lot.quantity = Number((lot.quantity - consumed).toFixed(3));
      remaining = Number((remaining - consumed).toFixed(3));
    }
  }

  return nextLots;
}

function buildFiscalPayload(order: Order, data: SaboreData) {
  const totals = calculateOrderTotals(order, data.products);

  return {
    unitId: order.unitId,
    orderId: order.id,
    reference: `sabore-${order.code}`,
    customer: order.customerId
      ? data.customers.find((customer) => customer.id === order.customerId)
      : undefined,
    items: order.items.map((item) => {
      const product = data.products.find((candidate) => candidate.id === item.productId);

      return {
        sku: product?.id ?? item.productId,
        name: product?.name ?? "Produto",
        quantity: item.quantity,
        unitPrice: product?.price ?? 0,
      };
    }),
    payments: order.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
    })),
    delivery: order.channel === "delivery",
    total: totals.total,
  };
}

export function SaboreApp({
  initialData,
  dataSource,
}: {
  initialData: SaboreData;
  dataSource?: { source: "supabase" | "demo"; message: string };
}) {
  const [activeView, setActiveView] = useState<View>("overview");
  const [orders, setOrders] = useState(() => cloneData(initialData.orders));
  const [lots, setLots] = useState(() => cloneData(initialData.lots));
  const [movements, setMovements] = useState(() => cloneData(initialData.movements));
  const [cashSession, setCashSession] = useState<CashSession>(() =>
    cloneData(initialData.cashSession),
  );
  const [activity, setActivity] = useState<string[]>([
    "Sabore iniciado com operacao demo em Ponta Verde",
    "Caixa aberto com R$ 150,00 de fundo",
  ]);
  const data = useMemo(
    () => ({ ...initialData, orders, lots, movements, cashSession }),
    [cashSession, initialData, lots, movements, orders],
  );
  const stockPositions = useMemo(
    () => calculateStockPositions(data.ingredients, lots, baseDate),
    [data.ingredients, lots],
  );
  const recipeCosts = useMemo(
    () =>
      data.products.map((product) =>
        calculateRecipeCost(product, data.ingredients, data.recipe),
      ),
    [data.ingredients, data.products, data.recipe],
  );
  const kitchenCounts = useMemo(() => calculateKitchenCounts(orders), [orders]);
  const paidOrders = orders.filter((order) => order.status === "paid");
  const openOrders = orders.filter(
    (order) => !["paid", "cancelled"].includes(order.status),
  );
  const paidTotal = paidOrders.reduce(
    (sum, order) => sum + calculateOrderTotals(order, data.products).paid,
    0,
  );
  const projectedTotal = orders.reduce(
    (sum, order) => sum + calculateOrderTotals(order, data.products).total,
    0,
  );
  const saleCost = movements
    .filter((movement) => movement.type === "sale" || movement.type === "waste")
    .reduce((sum, movement) => sum + movement.costImpact, 0);
  const cmv = projectedTotal > 0 ? saleCost / projectedTotal : 0;
  const closing = closeCashSession(cashSession, paidOrders, data.products);
  const riskLots = stockPositions.filter(
    (position) =>
      position.status !== "ok" ||
      (position.closestExpiryDays !== null && position.closestExpiryDays <= 3),
  );

  function log(message: string) {
    setActivity((current) => [message, ...current].slice(0, 6));
  }

  function createOrder(channel: SalesChannel) {
    const maxCode = Math.max(...orders.map((order) => Number(order.code)), 100);
    const code = String(maxCode + 1);
    const productBundles: Record<SalesChannel, Order["items"]> = {
      counter: [
        { id: `item-${code}-1`, productId: "prd-acai", quantity: 1 },
        { id: `item-${code}-2`, productId: "prd-tapioca", quantity: 1 },
      ],
      table: [
        { id: `item-${code}-1`, productId: "prd-poke", quantity: 1 },
        { id: `item-${code}-2`, productId: "prd-risoto", quantity: 1 },
      ],
      delivery: [
        { id: `item-${code}-1`, productId: "prd-risoto", quantity: 1 },
      ],
    };
    const tableId =
      channel === "table"
        ? data.tables.find((table) => table.status === "free")?.id ?? "table-2"
        : undefined;
    const order: Order = {
      id: `ord-${code}`,
      unitId: data.unit.id,
      code,
      channel,
      status: "new",
      openedAt: now,
      tableId,
      customerId: channel === "delivery" ? "cust-victor" : undefined,
      items: productBundles[channel],
      deliveryFee: channel === "delivery" ? 8 : 0,
      discount: 0,
      payments: [],
      fiscalStatus: data.unit.fiscalEnabled ? "pending" : "disabled",
      whatsappStatus: channel === "delivery" ? "queued" : "not_sent",
    };
    const stockMovements = reserveStockForOrder(
      order,
      data.recipe,
      data.ingredients,
      now,
    );

    setOrders((current) => [order, ...current]);
    setMovements((current) => [...stockMovements, ...current]);
    setLots((current) => deductLotsByMovements(current, stockMovements));
    log(`Pedido ${code} aberto em ${channelLabel[channel]} com baixa por ficha tecnica`);
  }

  function advanceOrder(orderId: string) {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, status: nextOrderStatus(order.status) }
          : order,
      ),
    );
    const order = orders.find((candidate) => candidate.id === orderId);

    if (order) {
      log(`Pedido ${order.code} mudou para ${statusLabel[nextOrderStatus(order.status)]}`);
    }
  }

  function payOrder(orderId: string, method: PaymentMethod) {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const totals = calculateOrderTotals(order, data.products);

        return {
          ...order,
          status: "paid",
          payments: [
            ...order.payments,
            {
              id: `pay-${order.code}-${method}`,
              method,
              amount: totals.remaining,
              receivedAt: now,
            },
          ],
        };
      }),
    );
    const order = orders.find((candidate) => candidate.id === orderId);

    if (order) log(`Pagamento ${paymentLabel[method]} registrado no pedido ${order.code}`);
  }

  async function issueFiscal(orderId: string) {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;

    const response = await fetch("/api/fiscal/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildFiscalPayload(order, data)),
    });
    const result = (await response.json()) as { status?: string; provider?: string };

    setOrders((current) =>
      current.map((candidate) =>
        candidate.id === orderId
          ? {
              ...candidate,
              fiscalStatus:
                result.status === "authorized" ? "authorized" : "rejected",
            }
          : candidate,
      ),
    );
    log(`NFC-e ${result.status ?? "processada"} via ${result.provider ?? "mock"}`);
  }

  async function sendWhatsApp(orderId: string) {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return;

    await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId: order.unitId,
        to: "+5582999991111",
        templateName: "pedido_status_delivery",
        parameters: {
          codigo: order.code,
          status: statusLabel[order.status],
        },
      }),
    });
    setOrders((current) =>
      current.map((candidate) =>
        candidate.id === orderId
          ? { ...candidate, whatsappStatus: "sent" }
          : candidate,
      ),
    );
    log(`WhatsApp de status enviado para pedido ${order.code}`);
  }

  function receiveStock() {
    const lot: InventoryLot = {
      id: `lot-camarao-${Date.now()}`,
      ingredientId: "ing-camarao",
      supplier: "Costa Sul",
      batchCode: "CAM-0503",
      quantity: 5,
      expiresAt: "2026-05-09",
      receivedAt: "2026-05-03",
    };
    const movement: InventoryMovement = {
      id: `mov-receipt-${Date.now()}`,
      unitId: data.unit.id,
      ingredientId: "ing-camarao",
      type: "receipt",
      quantity: 5,
      costImpact: 290,
      reason: "Recebimento emergencial de camarao",
      createdAt: now,
    };

    setLots((current) => [lot, ...current]);
    setMovements((current) => [movement, ...current]);
    log("Recebimento de camarao registrado com lote e validade");
  }

  function closeCash() {
    setCashSession((current) => ({
      ...current,
      status: "closed",
      expectedAmount: closing.expectedDrawer,
    }));
    log(`Caixa fechado com gaveta esperada de ${formatCurrency(closing.expectedDrawer)}`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-border bg-sidebar px-4 py-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 lg:block">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Utensils className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Sabore</p>
                  <p className="text-xs text-muted-foreground">PDV inteligente</p>
                </div>
              </div>
            </div>
            <Badge variant="success">{formatCurrency(data.organization.planPrice)}/mes</Badge>
          </div>
          <nav className="mt-5 grid grid-cols-3 gap-2 lg:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Button
                  key={item.id}
                  variant={activeView === item.id ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => setActiveView(item.id)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </nav>
          <div className="mt-6 hidden rounded-lg border border-border bg-muted/30 p-4 lg:block">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Unidade piloto
            </p>
            <p className="mt-2 text-sm font-semibold">{data.unit.name}</p>
            <p className="text-sm text-muted-foreground">
              {data.unit.neighborhood}, {data.unit.city}
            </p>
          </div>
        </aside>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Piloto local</Badge>
                <Badge variant="neutral">100% web online</Badge>
                <Badge variant="warning">Fiscal repassado</Badge>
                <Badge variant={dataSource?.source === "supabase" ? "success" : "neutral"}>
                  {dataSource?.source === "supabase" ? "Supabase" : "Demo"}
                </Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Controle completo do pedido ao CMV
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                PDV, mesas, delivery proprio, cozinha, estoque, validade, caixa,
                NFC-e via API e WhatsApp guiado em uma rotina unica.
              </p>
              {dataSource?.message && (
                <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
                  {dataSource.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <Button onClick={() => createOrder("counter")}>
                <Plus />
                Balcao
              </Button>
              <Button variant="secondary" onClick={() => createOrder("table")}>
                <Table2 />
                Mesa
              </Button>
              <Button variant="outline" onClick={() => createOrder("delivery")}>
                <Truck />
                Delivery
              </Button>
            </div>
          </header>

          {activeView === "overview" && (
            <OverviewView
              openOrders={openOrders.length}
              projectedTotal={projectedTotal}
              paidTotal={paidTotal}
              cmv={cmv}
              riskLots={riskLots.length}
              kitchenCounts={kitchenCounts}
              activity={activity}
              closing={closing}
              cashStatus={cashSession.status}
              onCloseCash={closeCash}
            />
          )}
          {activeView === "pos" && (
            <PosView
              orders={orders}
              data={data}
              onAdvance={advanceOrder}
              onPay={payOrder}
              onIssueFiscal={issueFiscal}
              onSendWhatsApp={sendWhatsApp}
            />
          )}
          {activeView === "kitchen" && (
            <KitchenView orders={orders} data={data} onAdvance={advanceOrder} />
          )}
          {activeView === "stock" && (
            <StockView
              positions={stockPositions}
              lots={lots}
              data={data}
              onReceiveStock={receiveStock}
            />
          )}
          {activeView === "reports" && (
            <ReportsView
              recipeCosts={recipeCosts}
              closing={closing}
              movements={movements}
              data={data}
              cmv={cmv}
            />
          )}
          {activeView === "integrations" && (
            <IntegrationsView data={data} orders={orders} />
          )}
        </main>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-md border",
              tone === "success" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
              tone === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-300",
              tone === "danger" && "border-red-500/20 bg-red-500/10 text-red-300",
              tone === "neutral" && "border-border bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </span>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function OverviewView({
  openOrders,
  projectedTotal,
  paidTotal,
  cmv,
  riskLots,
  kitchenCounts,
  activity,
  closing,
  cashStatus,
  onCloseCash,
}: {
  openOrders: number;
  projectedTotal: number;
  paidTotal: number;
  cmv: number;
  riskLots: number;
  kitchenCounts: { new: number; preparing: number; ready: number };
  activity: string[];
  closing: ReturnType<typeof closeCashSession>;
  cashStatus: CashSession["status"];
  onCloseCash: () => void;
}) {
  return (
    <div className="space-y-5 pt-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pedidos abertos"
          value={String(openOrders)}
          helper="Balcao, mesa e delivery entram no mesmo fluxo."
          icon={ClipboardList}
        />
        <MetricCard
          label="Venda projetada"
          value={formatCurrency(projectedTotal)}
          helper={`${formatCurrency(paidTotal)} ja recebido no caixa.`}
          icon={CircleDollarSign}
          tone="success"
        />
        <MetricCard
          label="CMV operacional"
          value={formatPercent(cmv)}
          helper="Calculado por ficha tecnica e perdas registradas."
          icon={BarChart3}
          tone={cmv > 0.38 ? "warning" : "success"}
        />
        <MetricCard
          label="Alertas de estoque"
          value={String(riskLots)}
          helper="Minimo, validade curta e itens criticos."
          icon={AlertTriangle}
          tone={riskLots > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Fila operacional</CardTitle>
            <CardDescription>Pedidos novos, em preparo e prontos para saida.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    label: "Novos",
                    value: kitchenCounts.new,
                    icon: Clock3,
                    variant: "neutral",
                  },
                  {
                    label: "Em preparo",
                    value: kitchenCounts.preparing,
                    icon: Timer,
                    variant: "warning",
                  },
                  {
                    label: "Prontos",
                    value: kitchenCounts.ready,
                    icon: CheckCircle2,
                    variant: "success",
                  },
                ] satisfies Array<{
                  label: string;
                  value: number;
                  icon: LucideIcon;
                  variant: "neutral" | "warning" | "success";
                }>
              ).map(({ label, value, icon: Icon, variant }) => (
                <div
                  key={label}
                  className="rounded-lg border border-border bg-muted/25 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold">{value}</p>
                  <Badge className="mt-3" variant={variant}>
                    Cozinha
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Caixa do turno</CardTitle>
              <CardDescription>Fechamento manual sem TEF no v1.</CardDescription>
            </div>
            <Badge variant={cashStatus === "open" ? "success" : "neutral"}>
              {cashStatus === "open" ? "Aberto" : "Fechado"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <Row label="Fundo inicial" value={formatCurrency(closing.openingAmount)} />
              <Row label="Vendas recebidas" value={formatCurrency(closing.salesTotal)} />
              <Row label="Gaveta esperada" value={formatCurrency(closing.expectedDrawer)} />
            </div>
            <Button
              className="mt-5 w-full"
              disabled={cashStatus === "closed"}
              onClick={onCloseCash}
            >
              <WalletCards />
              Fechar caixa
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
          <CardDescription>Eventos operacionais simulados no piloto.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {activity.map((entry, index) => (
              <div
                key={`${entry}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3"
              >
                <span className="mt-1 size-2 rounded-full bg-primary" />
                <p className="text-sm leading-6 text-muted-foreground">{entry}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PosView({
  orders,
  data,
  onAdvance,
  onPay,
  onIssueFiscal,
  onSendWhatsApp,
}: {
  orders: Order[];
  data: SaboreData;
  onAdvance: (orderId: string) => void;
  onPay: (orderId: string, method: PaymentMethod) => void;
  onIssueFiscal: (orderId: string) => void;
  onSendWhatsApp: (orderId: string) => void;
}) {
  return (
    <div className="space-y-4 pt-5">
      {orders.map((order) => {
        const totals = calculateOrderTotals(order, data.products);
        const ChannelIcon = channelIcon(order.channel);
        const canPay = totals.remaining > 0 && order.status !== "cancelled";

        return (
          <Card key={order.id}>
            <CardContent className="grid gap-5 p-5 xl:grid-cols-[1fr_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">#{order.code}</Badge>
                  <Badge variant="neutral">
                    <ChannelIcon className="mr-1 size-3" />
                    {channelLabel[order.channel]}
                  </Badge>
                  <Badge variant={orderStatusVariant(order.status)}>
                    {statusLabel[order.status]}
                  </Badge>
                  <Badge variant={order.fiscalStatus === "authorized" ? "success" : "neutral"}>
                    NFC-e {order.fiscalStatus}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span>{getItemLabel(item, data.products)}</span>
                      <span className="text-muted-foreground">{item.notes}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
                <Row label="Entrega" value={formatCurrency(totals.deliveryFee)} />
                <Row label="Desconto" value={formatCurrency(totals.discount)} />
                <Row label="Total" value={formatCurrency(totals.total)} strong />
                <Row label="Falta" value={formatCurrency(totals.remaining)} />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={order.status === "paid" || order.status === "cancelled"}
                    onClick={() => onAdvance(order.id)}
                  >
                    <RefreshCw />
                    Avancar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canPay}
                    onClick={() => onPay(order.id, order.channel === "delivery" ? "pix" : "cash")}
                  >
                    <CreditCard />
                    Pagar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={order.payments.length === 0}
                    onClick={() => onIssueFiscal(order.id)}
                  >
                    <ReceiptText />
                    NFC-e
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={order.channel !== "delivery"}
                    onClick={() => onSendWhatsApp(order.id)}
                  >
                    <Send />
                    WhatsApp
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function KitchenView({
  orders,
  data,
  onAdvance,
}: {
  orders: Order[];
  data: SaboreData;
  onAdvance: (orderId: string) => void;
}) {
  const columns: OrderStatus[] = ["new", "preparing", "ready"];

  return (
    <div className="grid gap-4 pt-5 xl:grid-cols-3">
      {columns.map((status) => (
        <Card key={status}>
          <CardHeader>
            <CardTitle>{statusLabel[status]}</CardTitle>
            <CardDescription>Fila de producao por status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders
              .filter((order) => order.status === status)
              .map((order) => (
                <div key={order.id} className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="info">#{order.code}</Badge>
                    <Badge variant="neutral">{channelLabel[order.channel]}</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {order.items.map((item) => (
                      <p key={item.id}>{getItemLabel(item, data.products)}</p>
                    ))}
                  </div>
                  <Button className="mt-4 w-full" size="sm" onClick={() => onAdvance(order.id)}>
                    <ArrowUpRight />
                    Proximo status
                  </Button>
                </div>
              ))}
            {!orders.some((order) => order.status === status) && (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Sem pedidos nesta coluna.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StockView({
  positions,
  lots,
  data,
  onReceiveStock,
}: {
  positions: ReturnType<typeof calculateStockPositions>;
  lots: InventoryLot[];
  data: SaboreData;
  onReceiveStock: () => void;
}) {
  return (
    <div className="space-y-5 pt-5">
      <div className="flex justify-end">
        <Button onClick={onReceiveStock}>
          <Plus />
          Receber insumo
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {positions.map((position) => (
          <Card key={position.ingredient.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{position.ingredient.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Minimo {position.minimumStock} {position.ingredient.measure}
                  </p>
                </div>
                <Badge
                  variant={
                    position.status === "ok"
                      ? "success"
                      : position.status === "low"
                        ? "warning"
                        : "danger"
                  }
                >
                  {position.status}
                </Badge>
              </div>
              <p className="mt-5 text-2xl font-semibold">
                {position.quantity.toFixed(2)} {position.ingredient.measure}
              </p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <Row label="Valor em estoque" value={formatCurrency(position.costValue)} />
                <Row
                  label="Validade mais proxima"
                  value={
                    position.closestExpiryDays === null
                      ? "-"
                      : `${position.closestExpiryDays} dias`
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lotes e validade</CardTitle>
          <CardDescription>Controle FEFO para reduzir perda de pereciveis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3">Insumo</th>
                  <th>Fornecedor</th>
                  <th>Lote</th>
                  <th>Quantidade</th>
                  <th>Validade</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const ingredient = data.ingredients.find(
                    (candidate) => candidate.id === lot.ingredientId,
                  );

                  return (
                    <tr key={lot.id} className="border-b border-border/60">
                      <td className="py-3 font-medium">{ingredient?.name}</td>
                      <td className="text-muted-foreground">{lot.supplier}</td>
                      <td className="font-mono text-xs text-muted-foreground">{lot.batchCode}</td>
                      <td>
                        {lot.quantity.toFixed(2)} {ingredient?.measure}
                      </td>
                      <td>{lot.expiresAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsView({
  recipeCosts,
  closing,
  movements,
  data,
  cmv,
}: {
  recipeCosts: ReturnType<typeof calculateRecipeCost>[];
  closing: ReturnType<typeof closeCashSession>;
  movements: InventoryMovement[];
  data: SaboreData;
  cmv: number;
}) {
  return (
    <div className="grid gap-5 pt-5 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Ficha tecnica e margem</CardTitle>
          <CardDescription>CMV teorico por produto vendido no piloto.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3">Produto</th>
                  <th>Preco</th>
                  <th>Custo</th>
                  <th>CMV</th>
                  <th>Margem</th>
                </tr>
              </thead>
              <tbody>
                {recipeCosts.map((cost) => (
                  <tr key={cost.productId} className="border-b border-border/60">
                    <td className="py-3 font-medium">{cost.productName}</td>
                    <td>{formatCurrency(cost.price)}</td>
                    <td>{formatCurrency(cost.cost)}</td>
                    <td>
                      <Badge variant={cost.cmv > 0.38 ? "warning" : "success"}>
                        {formatPercent(cost.cmv)}
                      </Badge>
                    </td>
                    <td>{formatCurrency(cost.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Resumo do turno</CardTitle>
            <CardDescription>Caixa e CMV lado a lado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Vendas pagas" value={formatCurrency(closing.salesTotal)} />
            <Row label="Gaveta esperada" value={formatCurrency(closing.expectedDrawer)} />
            <Row label="CMV atual" value={formatPercent(cmv)} strong />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movimentos recentes</CardTitle>
            <CardDescription>Entradas, baixas e perdas rastreadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {movements.slice(0, 6).map((movement) => {
              const ingredient = data.ingredients.find(
                (candidate) => candidate.id === movement.ingredientId,
              );

              return (
                <div key={movement.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{ingredient?.name}</p>
                    <Badge variant={movement.quantity < 0 ? "warning" : "success"}>
                      {movement.quantity > 0 ? "+" : ""}
                      {movement.quantity.toFixed(2)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{movement.reason}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IntegrationsView({ data, orders }: { data: SaboreData; orders: Order[] }) {
  const lastOrder = orders[0];
  const totals = lastOrder ? calculateOrderTotals(lastOrder, data.products) : null;

  return (
    <div className="grid gap-5 pt-5 xl:grid-cols-3">
      <IntegrationCard
        icon={ReceiptText}
        title="Focus NFe"
        badge="Adapter pronto"
        description="Endpoint /api/fiscal/nfce valida payload e usa mock ate FOCUS_NFE_TOKEN existir."
        lines={[
          "NFC-e modelo 65",
          "Referencia unica por pedido",
          "Cliente paga certificado, CSC e provedor",
        ]}
      />
      <IntegrationCard
        icon={CreditCard}
        title="Mercado Pago"
        badge="Pix e checkout"
        description="Endpoint /api/payments/mercado-pago cria cobranca mock ou real com token."
        lines={[
          `Ultimo pedido: ${lastOrder ? `#${lastOrder.code}` : "-"}`,
          `Total exemplo: ${totals ? formatCurrency(totals.total) : "-"}`,
          "Webhook idempotente documentado",
        ]}
      />
      <IntegrationCard
        icon={MessageCircle}
        title="WhatsApp"
        badge="Templates guiados"
        description="Endpoint /api/whatsapp/send envia template oficial ou enfileira mock."
        lines={[
          "Status de pedido no v1",
          "Promocoes como add-on",
          "Agente IA vendido separado",
        ]}
      />
    </div>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  badge,
  description,
  lines,
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  description: string;
  lines: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-10 items-center justify-center rounded-md border border-border bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </span>
          <Badge variant="info">{badge}</Badge>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-300" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", strong && "font-semibold text-foreground")}>
        {value}
      </span>
    </div>
  );
}

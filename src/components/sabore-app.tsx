"use client";

import { useEffect, useMemo, useState } from "react";
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
  FilePenLine,
  MessageCircle,
  Minus,
  PanelsTopLeft,
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
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
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
  buildPizzaItem,
  calculatePizzaPrice,
  createDefaultPizzaBuilder,
  getPizzaSize,
  getPizzaTopping,
  pizzaFlavors,
  pizzaSizes,
  pizzaToppings,
  type PizzaBuilderState,
  type PizzaSizeId,
} from "@/lib/pizza-menu";
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
  Product,
  RecipeItem,
  SaboreData,
  SalesChannel,
} from "@/lib/types";

type View =
  | "overview"
  | "service"
  | "tables"
  | "delivery"
  | "kitchen"
  | "catalog"
  | "stock"
  | "reports"
  | "integrations";

type ComposerCustomItem = {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
};

type ComposerState = {
  channel: SalesChannel;
  existingOrderId?: string;
  tableId: string;
  customerId: string;
  items: Record<string, number>;
  notes: Record<string, string>;
  customItems: ComposerCustomItem[];
  pizzaBuilder: PizzaBuilderState;
  deliveryFee: string;
  discount: string;
};

type ProductForm = {
  name: string;
  category: string;
  price: string;
  preparationArea: Product["preparationArea"];
};

type RecipeForm = {
  productId: string;
  ingredientId: string;
  quantity: string;
};

type StockAdjustmentForm = {
  ingredientId: string;
  quantity: string;
  direction: "in" | "out";
  reason: string;
  supplier: string;
  batchCode: string;
  expiresAt: string;
};

type TableForm = {
  label: string;
  seats: string;
};

type StockDialog = "movement" | "lots" | null;

const statusLabel: Record<OrderStatus, string> = {
  new: "Fila",
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

function getCurrentIso() {
  return new Date().toISOString();
}

const navItems: Array<{
  id: View;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "Painel", icon: Store },
  { id: "service", label: "Atendimento", icon: ShoppingCart },
  { id: "tables", label: "Mesas", icon: Table2 },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "kitchen", label: "Cozinha", icon: ChefHat },
  { id: "catalog", label: "Cadastro", icon: PanelsTopLeft },
  { id: "stock", label: "Estoque", icon: PackageCheck },
  { id: "reports", label: "Relatorios", icon: BarChart3 },
  { id: "integrations", label: "Integracoes", icon: ReceiptText },
];

const emptyComposerItems: ComposerState["items"] = {};
const emptyComposerNotes: ComposerState["notes"] = {};

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

function kitchenActionLabel(status: OrderStatus) {
  const labels: Partial<Record<OrderStatus, string>> = {
    new: "Em preparo",
    preparing: "Pronto",
    ready: "Entregar",
  };

  return labels[status] ?? "Avancar";
}

function minutesSince(isoDate: string, baseIso = getCurrentIso()) {
  const start = new Date(isoDate).getTime();
  const end = new Date(baseIso).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.round((end - start) / 60_000));
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
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

export function SaboreApp({
  initialData,
  dataSource,
}: {
  initialData: SaboreData;
  dataSource?: { source: "supabase" | "demo"; message: string };
}) {
  const [activeView, setActiveView] = useState<View>("overview");
  const [stockDialog, setStockDialog] = useState<StockDialog>(null);
  const [orders, setOrders] = useState(() => cloneData(initialData.orders));
  const [lots, setLots] = useState(() => cloneData(initialData.lots));
  const [movements, setMovements] = useState(() => cloneData(initialData.movements));
  const [products, setProducts] = useState(() => cloneData(initialData.products));
  const [recipe, setRecipe] = useState(() => cloneData(initialData.recipe));
  const [tables, setTables] = useState(() => cloneData(initialData.tables));
  const [clockIso, setClockIso] = useState(() => getCurrentIso());
  const [cashSession, setCashSession] = useState<CashSession>(() =>
    cloneData(initialData.cashSession),
  );
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [activity, setActivity] = useState<string[]>([
    "Sabore iniciado com pizzaria demo em Ponta Verde",
    "Caixa aberto com R$ 150,00 de fundo",
  ]);
  useEffect(() => {
    const interval = window.setInterval(() => setClockIso(getCurrentIso()), 10_000);

    return () => window.clearInterval(interval);
  }, []);
  const data = useMemo(
    () => ({
      ...initialData,
      orders,
      lots,
      movements,
      products,
      recipe,
      tables,
      cashSession,
    }),
    [cashSession, initialData, lots, movements, orders, products, recipe, tables],
  );
  const stockPositions = useMemo(
    () => calculateStockPositions(data.ingredients, lots, new Date(clockIso)),
    [clockIso, data.ingredients, lots],
  );
  const recipeCosts = useMemo(
    () =>
      data.products
        .filter((product) => product.active)
        .map((product) =>
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

  function timestamp() {
    const iso = getCurrentIso();
    setClockIso(iso);

    return iso;
  }

  function changeView(view: View) {
    setComposer(null);
    setStockDialog(null);
    setActiveView(view);
  }

  function openComposer(
    channel: SalesChannel,
    options: {
      tableId?: string;
      customerId?: string;
      existingOrderId?: string;
    } = {},
  ) {
    setActiveView(
      channel === "delivery"
        ? "delivery"
        : options.existingOrderId
          ? "service"
          : "tables",
    );
    setComposer({
      channel,
      existingOrderId: options.existingOrderId,
      tableId:
        options.tableId ??
        (channel === "table"
          ? data.tables.find((table) => table.status === "free")?.id ?? ""
          : ""),
      customerId:
        options.customerId ??
        (channel === "delivery" ? data.customers[0]?.id ?? "" : ""),
      items: { ...emptyComposerItems },
      notes: { ...emptyComposerNotes },
      customItems: [],
      pizzaBuilder: createDefaultPizzaBuilder(),
      deliveryFee: channel === "delivery" ? "8" : "0",
      discount: "0",
    });
  }

  function updateComposerItem(productId: string, delta: number) {
    setComposer((current) => {
      if (!current) return current;

      const quantity = Math.max(0, (current.items[productId] ?? 0) + delta);
      const items = { ...current.items };
      const notes = { ...current.notes };

      if (quantity === 0) {
        delete items[productId];
        delete notes[productId];
      } else {
        items[productId] = quantity;
      }

      return { ...current, items, notes };
    });
  }

  function updateComposerNote(productId: string, note: string) {
    setComposer((current) =>
      current
        ? { ...current, notes: { ...current.notes, [productId]: note } }
        : current,
    );
  }

  function patchPizzaBuilder(patch: Partial<PizzaBuilderState>) {
    setComposer((current) =>
      current
        ? {
            ...current,
            pizzaBuilder: { ...current.pizzaBuilder, ...patch },
          }
        : current,
    );
  }

  function togglePizzaFlavor(flavorId: string) {
    setComposer((current) => {
      if (!current) return current;

      const selected = current.pizzaBuilder.flavorIds.includes(flavorId);
      let flavorIds = current.pizzaBuilder.flavorIds;

      if (selected) {
        flavorIds =
          flavorIds.length > 1
            ? flavorIds.filter((candidate) => candidate !== flavorId)
            : flavorIds;
      } else if (flavorIds.length < 2) {
        flavorIds = [...flavorIds, flavorId];
      }

      return {
        ...current,
        pizzaBuilder: { ...current.pizzaBuilder, flavorIds },
      };
    });
  }

  function togglePizzaTopping(toppingId: string) {
    setComposer((current) => {
      if (!current) return current;

      const selected = current.pizzaBuilder.toppingIds.includes(toppingId);
      const topping = getPizzaTopping(toppingId);
      let toppingIds = selected
        ? current.pizzaBuilder.toppingIds.filter(
            (candidate) => candidate !== toppingId,
          )
        : [...current.pizzaBuilder.toppingIds, toppingId];

      if (!selected && topping?.type === "borda") {
        toppingIds = [
          ...current.pizzaBuilder.toppingIds.filter((candidate) => {
            const existing = getPizzaTopping(candidate);

            return existing?.type !== "borda";
          }),
          toppingId,
        ];
      }

      return {
        ...current,
        pizzaBuilder: { ...current.pizzaBuilder, toppingIds },
      };
    });
  }

  function addPizzaToComposer() {
    setComposer((current) => {
      if (!current) return current;

      const pizzaItem = buildPizzaItem(current.pizzaBuilder, data.products);

      if (!pizzaItem) return current;

      return {
        ...current,
        customItems: [
          ...current.customItems,
          {
            id: `pizza-${Date.now()}`,
            quantity: 1,
            ...pizzaItem,
          },
        ],
      };
    });
  }

  function removeCustomItem(itemId: string) {
    setComposer((current) =>
      current
        ? {
            ...current,
            customItems: current.customItems.filter((item) => item.id !== itemId),
          }
        : current,
    );
  }

  function patchComposer(patch: Partial<ComposerState>) {
    setComposer((current) => (current ? { ...current, ...patch } : current));
  }

  function submitComposer() {
    if (!composer) return;

    const catalogItems = Object.entries(composer.items)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity], index) => ({
        id: `item-${Date.now()}-${index}`,
        productId,
        quantity,
        notes: composer.notes[productId]?.trim() || undefined,
      }));
    const customItems = composer.customItems.map((item, index) => ({
      id: `item-${Date.now()}-custom-${index}`,
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes,
      name: item.name,
      unitPrice: item.unitPrice,
    }));
    const selectedItems = [...catalogItems, ...customItems];

    if (selectedItems.length === 0) {
      log("Selecione pelo menos um item antes de abrir o pedido");
      return;
    }

    if (composer.channel === "table" && !composer.tableId) {
      log("Selecione uma mesa para abrir o pedido");
      return;
    }

    if (composer.channel === "delivery" && !composer.customerId) {
      log("Selecione um cliente para abrir o delivery");
      return;
    }

    if (composer.existingOrderId) {
      const existingOrder = orders.find(
        (order) => order.id === composer.existingOrderId,
      );

      if (!existingOrder) {
        log("Pedido em atendimento nao encontrado");
        return;
      }

      const createdAt = timestamp();
      const stockMovements = reserveStockForOrder(
        {
          ...existingOrder,
          id: `${existingOrder.id}-${Date.now()}`,
          items: selectedItems,
        },
        data.recipe,
        data.ingredients,
        createdAt,
      ).map((movement) => ({
        ...movement,
        id: `${movement.id}-${Date.now()}`,
        orderId: existingOrder.id,
      }));

      setOrders((current) =>
        current.map((order) =>
          order.id === existingOrder.id
            ? { ...order, items: [...order.items, ...selectedItems] }
            : order,
        ),
      );
      setMovements((current) => [...stockMovements, ...current]);
      setLots((current) => deductLotsByMovements(current, stockMovements));
      setComposer(null);
      log(
        `${selectedItems.length} item(ns) lancados na ${data.tables.find((table) => table.id === existingOrder.tableId)?.label ?? `mesa do pedido ${existingOrder.code}`}`,
      );
      return;
    }

    const maxCode = Math.max(...orders.map((order) => Number(order.code)), 100);
    const code = String(maxCode + 1);
    const order: Order = {
      id: `ord-${Date.now()}`,
      unitId: data.unit.id,
      code,
      channel: composer.channel,
      status: "new",
      openedAt: timestamp(),
      tableId: composer.channel === "table" ? composer.tableId : undefined,
      customerId:
        composer.channel === "delivery" ? composer.customerId : undefined,
      items: selectedItems,
      deliveryFee: Math.max(0, Number(composer.deliveryFee) || 0),
      discount: Math.max(0, Number(composer.discount) || 0),
      payments: [],
      fiscalStatus: data.unit.fiscalEnabled ? "pending" : "disabled",
      whatsappStatus: composer.channel === "delivery" ? "queued" : "not_sent",
    };
    const stockMovements = reserveStockForOrder(
      order,
      data.recipe,
      data.ingredients,
      order.openedAt,
    );

    setOrders((current) => [order, ...current]);
    if (order.channel === "table" && order.tableId) {
      setTables((current) =>
        current.map((table) =>
          table.id === order.tableId ? { ...table, status: "open" } : table,
        ),
      );
    }
    setMovements((current) => [...stockMovements, ...current]);
    setLots((current) => deductLotsByMovements(current, stockMovements));
    setComposer(null);
    log(
      `Pedido ${code} aberto em ${channelLabel[order.channel]} com ${selectedItems.length} item(ns)`,
    );
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
              receivedAt: timestamp(),
            },
          ],
        };
      }),
    );
    const order = orders.find((candidate) => candidate.id === orderId);

    if (order?.tableId) {
      setTables((current) =>
        current.map((table) =>
          table.id === order.tableId ? { ...table, status: "free" } : table,
        ),
      );
    }

    if (order) log(`Pagamento ${paymentLabel[method]} registrado no pedido ${order.code}`);
  }

  function generateBill(orderId: string) {
    const order = orders.find((candidate) => candidate.id === orderId);

    if (order) {
      log(`Conta do pedido ${order.code} gerada para conferencia`);
    }
  }

  function finalizeOrder(orderId: string) {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const totals = calculateOrderTotals(order, data.products);

        return {
          ...order,
          status: "paid",
          payments:
            totals.remaining > 0
              ? [
                  ...order.payments,
                  {
                    id: `pay-${order.code}-final`,
                    method: "cash",
                    amount: totals.remaining,
                    receivedAt: timestamp(),
                  },
                ]
              : order.payments,
        };
      }),
    );
    const order = orders.find((candidate) => candidate.id === orderId);

    if (order?.tableId) {
      setTables((current) =>
        current.map((table) =>
          table.id === order.tableId ? { ...table, status: "free" } : table,
        ),
      );
    }

    if (order) log(`Mesa/pedido ${order.code} finalizado no caixa`);
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

  function addProduct(form: ProductForm) {
    const price = Math.max(0, Number(form.price) || 0);

    if (!form.name.trim() || price <= 0) {
      log("Informe nome e preco para cadastrar o item do cardapio");
      return;
    }

    const product: Product = {
      id: `prd-${Date.now()}`,
      unitId: data.unit.id,
      name: form.name.trim(),
      category: form.category.trim() || "Cardapio",
      price,
      active: true,
      preparationArea: form.preparationArea,
    };

    setProducts((current) => [product, ...current]);
    log(`${product.name} cadastrado no cardapio`);
  }

  function addRecipeItem(form: RecipeForm) {
    const quantity = Math.max(0, Number(form.quantity) || 0);
    const product = products.find((candidate) => candidate.id === form.productId);
    const ingredient = data.ingredients.find(
      (candidate) => candidate.id === form.ingredientId,
    );

    if (!product || !ingredient || quantity <= 0) {
      log("Selecione produto, insumo e quantidade para a ficha tecnica");
      return;
    }

    const item: RecipeItem = {
      id: `rec-${Date.now()}`,
      productId: product.id,
      ingredientId: ingredient.id,
      quantity,
    };

    setRecipe((current) => [item, ...current]);
    log(
      `Ficha tecnica: ${quantity} ${ingredient.measure} de ${ingredient.name} em ${product.name}`,
    );
  }

  function adjustStock(form: StockAdjustmentForm) {
    const createdAt = timestamp();
    const ingredient = data.ingredients.find(
      (candidate) => candidate.id === form.ingredientId,
    );
    const rawQuantity = Math.max(0, Number(form.quantity) || 0);

    if (!ingredient || rawQuantity <= 0) {
      log("Selecione um insumo e informe a quantidade do ajuste");
      return false;
    }

    const signedQuantity = form.direction === "in" ? rawQuantity : -rawQuantity;
    const reason = form.reason.trim() || (form.direction === "in" ? "compra" : "venda");
    const movement: InventoryMovement = {
      id: `mov-manual-${Date.now()}`,
      unitId: data.unit.id,
      ingredientId: ingredient.id,
      type: form.direction === "in" ? "receipt" : "manual_exit",
      quantity: signedQuantity,
      costImpact: Math.abs(signedQuantity) * ingredient.averageCost,
      reason,
      createdAt,
    };

    if (form.direction === "in") {
      const lot: InventoryLot = {
        id: `lot-manual-${Date.now()}`,
        ingredientId: ingredient.id,
        supplier: form.supplier.trim() || "Fornecedor manual",
        batchCode: form.batchCode.trim() || `MAN-${Date.now()}`,
        quantity: rawQuantity,
        expiresAt: form.expiresAt || "2026-12-31",
        receivedAt: createdAt.slice(0, 10),
      };

      setLots((current) => [lot, ...current]);
      setMovements((current) => [movement, ...current]);
      log(`Entrada manual: ${rawQuantity} ${ingredient.measure} de ${ingredient.name}`);
      return true;
    }

    setMovements((current) => [movement, ...current]);
    setLots((current) => deductLotsByMovements(current, [movement]));
    log(`Baixa manual: ${rawQuantity} ${ingredient.measure} de ${ingredient.name} - ${reason}`);
    return true;
  }

  function addTable(form: TableForm) {
    const seats = Math.max(1, Number(form.seats) || 0);

    if (!form.label.trim()) {
      log("Informe o nome da mesa para cadastrar");
      return;
    }

    setTables((current) => [
      ...current,
      {
        id: `table-${Date.now()}`,
        unitId: data.unit.id,
        label: form.label.trim(),
        seats,
        status: "free",
      },
    ]);
    log(`${form.label.trim()} cadastrada com ${seats} lugares`);
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
                <BrandMark />
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
                  onClick={() => changeView(item.id)}
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
              <Button onClick={() => changeView("service")}>
                <ShoppingCart />
                Atendimento
              </Button>
              <Button variant="secondary" onClick={() => changeView("tables")}>
                <Table2 />
                Mesas
              </Button>
              <Button variant="outline" onClick={() => changeView("delivery")}>
                <Truck />
                Delivery
              </Button>
            </div>
          </header>

          {composer && (
            <OrderComposer
              composer={composer}
              data={data}
              onPatch={patchComposer}
              onChangeItem={updateComposerItem}
              onChangeNote={updateComposerNote}
              onPatchPizzaBuilder={patchPizzaBuilder}
              onTogglePizzaFlavor={togglePizzaFlavor}
              onTogglePizzaTopping={togglePizzaTopping}
              onAddPizza={addPizzaToComposer}
              onRemoveCustomItem={removeCustomItem}
              onClose={() => setComposer(null)}
              onSubmit={submitComposer}
            />
          )}

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
          {activeView === "service" && (
            <ServiceView
              orders={orders}
              data={data}
              onAddItems={(order) =>
                openComposer("table", {
                  existingOrderId: order.id,
                  tableId: order.tableId,
                })
              }
              onGenerateBill={generateBill}
              onFinalize={finalizeOrder}
            />
          )}
          {activeView === "tables" && (
            <TablesView
              orders={orders}
              data={data}
              onOpenTable={(tableId) => openComposer("table", { tableId })}
              onAddItems={(order) =>
                openComposer("table", {
                  existingOrderId: order.id,
                  tableId: order.tableId,
                })
              }
              onFinalize={finalizeOrder}
            />
          )}
          {activeView === "delivery" && (
            <DeliveryView
              orders={orders}
              data={data}
              onNewDelivery={() => openComposer("delivery")}
              onAdvance={advanceOrder}
              onPay={payOrder}
              onSendWhatsApp={sendWhatsApp}
            />
          )}
          {activeView === "kitchen" && (
            <KitchenView orders={orders} data={data} onAdvance={advanceOrder} />
          )}
          {activeView === "catalog" && (
            <CatalogView
              data={data}
              onAddProduct={addProduct}
              onAddRecipeItem={addRecipeItem}
              onAddTable={addTable}
            />
          )}
          {activeView === "stock" && (
            <StockView
              positions={stockPositions}
              lots={lots}
              data={data}
              dialog={stockDialog}
              onOpenDialog={setStockDialog}
              onAdjustStock={adjustStock}
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
              tone === "success" && "border-emerald-600/20 bg-emerald-500/10 text-emerald-700",
              tone === "warning" && "border-amber-600/25 bg-amber-500/15 text-amber-800",
              tone === "danger" && "border-red-600/20 bg-red-500/10 text-red-700",
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

function OrderComposer({
  composer,
  data,
  onPatch,
  onChangeItem,
  onChangeNote,
  onPatchPizzaBuilder,
  onTogglePizzaFlavor,
  onTogglePizzaTopping,
  onAddPizza,
  onRemoveCustomItem,
  onClose,
  onSubmit,
}: {
  composer: ComposerState;
  data: SaboreData;
  onPatch: (patch: Partial<ComposerState>) => void;
  onChangeItem: (productId: string, delta: number) => void;
  onChangeNote: (productId: string, note: string) => void;
  onPatchPizzaBuilder: (patch: Partial<PizzaBuilderState>) => void;
  onTogglePizzaFlavor: (flavorId: string) => void;
  onTogglePizzaTopping: (toppingId: string) => void;
  onAddPizza: () => void;
  onRemoveCustomItem: (itemId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const activeProducts = data.products.filter(
    (product) => product.active && product.category !== "Pizzas",
  );
  const selectedCatalogItems = Object.entries(composer.items).filter(
    ([, quantity]) => quantity > 0,
  );
  const catalogSubtotal = selectedCatalogItems.reduce((sum, [productId, quantity]) => {
    const product = data.products.find((candidate) => candidate.id === productId);

    return sum + (product?.price ?? 0) * quantity;
  }, 0);
  const customSubtotal = composer.customItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const subtotal = catalogSubtotal + customSubtotal;
  const deliveryFee = Math.max(0, Number(composer.deliveryFee) || 0);
  const discount = Math.max(0, Number(composer.discount) || 0);
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const selectedCount = selectedCatalogItems.length + composer.customItems.length;
  const pizzaSize = getPizzaSize(composer.pizzaBuilder.sizeId);
  const pizzaPreview = buildPizzaItem(composer.pizzaBuilder, data.products);
  const pizzaBasePrice = composer.pizzaBuilder.flavorIds.length
    ? calculatePizzaPrice({ ...composer.pizzaBuilder, toppingIds: [] })
    : 0;
  const pizzaToppingsPrice = composer.pizzaBuilder.toppingIds.reduce(
    (sum, toppingId) =>
      sum + (getPizzaTopping(toppingId)?.prices[composer.pizzaBuilder.sizeId] ?? 0),
    0,
  );
  const selectedTable = composer.tableId
    ? data.tables.find((table) => table.id === composer.tableId)
    : undefined;
  const existingOrder = composer.existingOrderId
    ? data.orders.find((order) => order.id === composer.existingOrderId)
    : undefined;

  return (
    <Card className="mt-5">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>
            {composer.existingOrderId
              ? `Adicionar itens ${selectedTable?.label ?? `pedido #${existingOrder?.code}`}`
              : `Novo pedido ${channelLabel[composer.channel]}`}
          </CardTitle>
          <CardDescription>
            Lance itens, quantidades e destino antes de enviar para a cozinha.
          </CardDescription>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Fechar lancamento"
        >
          <X />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {composer.channel === "table" && (
            <div>
              <p className="mb-2 text-sm font-medium">Mesa</p>
              {selectedTable ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
                  <div>
                    <p className="font-medium">{selectedTable.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTable.seats} lugares
                      {existingOrder ? ` · pedido #${existingOrder.code}` : ""}
                    </p>
                  </div>
                  <Badge variant={existingOrder ? "warning" : "success"}>
                    {existingOrder ? "Em consumo" : "Selecionada"}
                  </Badge>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {data.tables.map((table) => (
                    <Button
                      key={table.id}
                      variant={
                        composer.tableId === table.id ? "secondary" : "outline"
                      }
                      onClick={() => onPatch({ tableId: table.id })}
                    >
                      <Table2 />
                      {table.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {composer.channel === "delivery" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Cliente</p>
                <div className="grid gap-2">
                  {data.customers.map((customer) => (
                    <Button
                      key={customer.id}
                      variant={
                        composer.customerId === customer.id ? "secondary" : "outline"
                      }
                      className="justify-start"
                      onClick={() => onPatch({ customerId: customer.id })}
                    >
                      <Truck />
                      <span className="truncate">{customer.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <MoneyField
                label="Taxa de entrega"
                value={composer.deliveryFee}
                onChange={(deliveryFee) => onPatch({ deliveryFee })}
              />
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">Monte sua pizza</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha tamanho, ate 2 sabores e adicionais. O preco atualiza na hora.
                </p>
              </div>
              <Badge variant="warning">
                {pizzaSize.label} - {pizzaSize.diameter} - {pizzaSize.slices} fatias
              </Badge>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Tamanho
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {pizzaSizes.map((size) => (
                    <Button
                      key={size.id}
                      variant={
                        composer.pizzaBuilder.sizeId === size.id ? "secondary" : "outline"
                      }
                      onClick={() =>
                        onPatchPizzaBuilder({ sizeId: size.id as PizzaSizeId })
                      }
                    >
                      {size.label}
                      <span className="text-xs font-normal">{size.diameter}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Sabores
                  </p>
                  <Badge variant="neutral">
                    {composer.pizzaBuilder.flavorIds.length}/2 selecionados
                  </Badge>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {pizzaFlavors.map((flavor) => {
                    const selected = composer.pizzaBuilder.flavorIds.includes(
                      flavor.id,
                    );
                    const limitReached =
                      composer.pizzaBuilder.flavorIds.length >= 2 && !selected;

                    return (
                      <button
                        key={flavor.id}
                        type="button"
                        disabled={limitReached}
                        className={cn(
                          "rounded-md border border-border bg-background p-3 text-left text-sm transition hover:bg-accent disabled:opacity-50",
                          selected && "border-primary bg-primary/10",
                        )}
                        onClick={() => onTogglePizzaFlavor(flavor.id)}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-medium">{flavor.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(flavor.prices[composer.pizzaBuilder.sizeId])}
                          </span>
                        </span>
                        <span className="mt-1 block leading-5 text-muted-foreground">
                          {flavor.ingredients}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Bordas e extras
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pizzaToppings.map((topping) => {
                    const selected = composer.pizzaBuilder.toppingIds.includes(
                      topping.id,
                    );

                    return (
                      <Button
                        key={topping.id}
                        variant={selected ? "secondary" : "outline"}
                        className="justify-between"
                        onClick={() => onTogglePizzaTopping(topping.id)}
                      >
                        <span>{topping.name}</span>
                        <span className="text-xs font-normal">
                          +{formatCurrency(topping.prices[composer.pizzaBuilder.sizeId])}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {pizzaPreview?.name ?? "Escolha pelo menos 1 sabor"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Base {formatCurrency(pizzaBasePrice)} - adicionais{" "}
                      {formatCurrency(pizzaToppingsPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-semibold">
                      {formatCurrency(pizzaPreview?.unitPrice ?? 0)}
                    </p>
                    <Button disabled={!pizzaPreview} onClick={onAddPizza}>
                      <Plus />
                      Adicionar pizza
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Cardapio</p>
              <Badge variant="neutral">{activeProducts.length} produtos</Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {activeProducts.map((product) => {
                const quantity = composer.items[product.id] ?? 0;

                return (
                  <div
                    key={product.id}
                    className="rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {product.category} · {formatCurrency(product.price)}
                        </p>
                      </div>
                      <Badge variant="neutral">{product.preparationArea}</Badge>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Remover ${product.name}`}
                        onClick={() => onChangeItem(product.id, -1)}
                      >
                        <Minus />
                      </Button>
                      <span className="flex h-9 min-w-10 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-semibold">
                        {quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="secondary"
                        aria-label={`Adicionar ${product.name}`}
                        onClick={() => onChangeItem(product.id, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    {quantity > 0 && (
                      <input
                        className="mt-3 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                        placeholder="Observacao do item"
                        value={composer.notes[product.id] ?? ""}
                        onChange={(event) =>
                          onChangeNote(product.id, event.target.value)
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-5">
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold leading-none">Resumo</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {selectedCount} item(ns) selecionado(s)
              </p>
            </div>
            <div className="mt-5 space-y-3">
              <div className="space-y-2">
                {selectedCatalogItems.map(([productId, quantity]) => {
                  const product = data.products.find(
                    (candidate) => candidate.id === productId,
                  );

                  return (
                    <Row
                      key={productId}
                      label={`${quantity}x ${product?.name ?? "Produto"}`}
                      value={formatCurrency((product?.price ?? 0) * quantity)}
                    />
                  );
                })}
                {composer.customItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.quantity}x {item.name}</p>
                      {item.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => onRemoveCustomItem(item.id)}
                      >
                        <X />
                      </Button>
                    </div>
                  </div>
                ))}
                {selectedCount === 0 && (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Nenhum item selecionado.
                  </p>
                )}
              </div>
              {!composer.existingOrderId && (
                <MoneyField
                  label="Desconto"
                  value={composer.discount}
                  onChange={(discountValue) => onPatch({ discount: discountValue })}
                />
              )}
              <div className="space-y-2 border-t border-border pt-3 text-sm">
                <Row label="Subtotal" value={formatCurrency(subtotal)} />
                {composer.channel === "delivery" && (
                  <Row label="Entrega" value={formatCurrency(deliveryFee)} />
                )}
                {!composer.existingOrderId && (
                  <Row label="Desconto" value={formatCurrency(discount)} />
                )}
                <Row label="Total" value={formatCurrency(total)} strong />
              </div>
              <Button className="w-full" onClick={onSubmit}>
                <Send />
                {composer.existingOrderId ? "Lancar itens" : "Abrir pedido"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(",", "."))}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ServiceView({
  orders,
  data,
  onAddItems,
  onGenerateBill,
  onFinalize,
}: {
  orders: Order[];
  data: SaboreData;
  onAddItems: (order: Order) => void;
  onGenerateBill: (orderId: string) => void;
  onFinalize: (orderId: string) => void;
}) {
  const tableOrders = orders.filter(
    (order) =>
      order.channel === "table" &&
      !["paid", "cancelled"].includes(order.status),
  );

  return (
    <div className="space-y-5 pt-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Mesas em consumo"
          value={String(tableOrders.length)}
          helper="Mesas abertas aguardando itens, preparo ou fechamento."
          icon={Table2}
        />
        <MetricCard
          label="Ticket em atendimento"
          value={formatCurrency(
            tableOrders.reduce(
              (sum, order) =>
                sum + calculateOrderTotals(order, data.products).total,
              0,
            ),
          )}
          helper="Total ainda aberto nas mesas."
          icon={CircleDollarSign}
          tone="success"
        />
        <MetricCard
          label="Tempo medio"
          value={formatDuration(
            tableOrders.length
              ? Math.round(
                  tableOrders.reduce(
                    (sum, order) => sum + minutesSince(order.openedAt),
                    0,
                  ) / tableOrders.length,
                )
              : 0,
          )}
          helper="Tempo medio das mesas abertas."
          icon={Timer}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {tableOrders.map((order) => {
          const table = data.tables.find((candidate) => candidate.id === order.tableId);
          const totals = calculateOrderTotals(order, data.products);

          return (
            <Card key={order.id}>
              <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_240px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{table?.label ?? "Mesa"}</Badge>
                    <Badge variant="info">#{order.code}</Badge>
                    <Badge variant={orderStatusVariant(order.status)}>
                      {statusLabel[order.status]}
                    </Badge>
                    <Badge variant="neutral">
                      <Clock3 className="mr-1 size-3" />
                      {formatDuration(minutesSince(order.openedAt))}
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
                  <Row label="Total" value={formatCurrency(totals.total)} strong />
                  <Row label="Falta" value={formatCurrency(totals.remaining)} />
                  <Button className="w-full" size="sm" onClick={() => onAddItems(order)}>
                    <Plus />
                    Lancar itens
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => onGenerateBill(order.id)}
                  >
                    <ReceiptText />
                    Gerar conta
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="secondary"
                    onClick={() => onFinalize(order.id)}
                  >
                    <WalletCards />
                    Finalizar mesa
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {tableOrders.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhuma mesa em atendimento. Abra uma mesa na tela Mesas.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TablesView({
  orders,
  data,
  onOpenTable,
  onAddItems,
  onFinalize,
}: {
  orders: Order[];
  data: SaboreData;
  onOpenTable: (tableId: string) => void;
  onAddItems: (order: Order) => void;
  onFinalize: (orderId: string) => void;
}) {
  const activeTableOrders = orders.filter(
    (order) =>
      order.channel === "table" &&
      !["paid", "cancelled"].includes(order.status),
  );

  return (
    <div className="space-y-5 pt-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.tables.map((table) => {
          const activeOrder = activeTableOrders.find(
            (order) => order.tableId === table.id,
          );
          const totals = activeOrder
            ? calculateOrderTotals(activeOrder, data.products)
            : null;
          const isAvailable = !activeOrder && table.status !== "closing";

          return (
            <Card key={table.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{table.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {table.seats} lugares
                    </p>
                  </div>
                  <Badge
                    variant={
                      activeOrder ? "warning" : isAvailable ? "success" : "neutral"
                    }
                  >
                    {activeOrder
                      ? "Em consumo"
                      : isAvailable
                        ? "Disponivel"
                        : "Fechando"}
                  </Badge>
                </div>

                {activeOrder && totals ? (
                  <div className="mt-5 space-y-3">
                    <Row label={`Pedido #${activeOrder.code}`} value={formatDuration(minutesSince(activeOrder.openedAt))} />
                    <Row label="Total" value={formatCurrency(totals.total)} strong />
                    <Button className="w-full" size="sm" onClick={() => onAddItems(activeOrder)}>
                      <Plus />
                      Atender mesa
                    </Button>
                    <Button
                      className="w-full"
                      size="sm"
                      variant="secondary"
                      onClick={() => onFinalize(activeOrder.id)}
                    >
                      <WalletCards />
                      Finalizar
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="mt-5 w-full"
                    size="sm"
                    variant={isAvailable ? "default" : "outline"}
                    disabled={!isAvailable}
                    onClick={() => onOpenTable(table.id)}
                  >
                    <Table2 />
                    Abrir mesa
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DeliveryView({
  orders,
  data,
  onNewDelivery,
  onAdvance,
  onPay,
  onSendWhatsApp,
}: {
  orders: Order[];
  data: SaboreData;
  onNewDelivery: () => void;
  onAdvance: (orderId: string) => void;
  onPay: (orderId: string, method: PaymentMethod) => void;
  onSendWhatsApp: (orderId: string) => void;
}) {
  const deliveryOrders = orders.filter(
    (order) =>
      order.channel === "delivery" &&
      !["paid", "cancelled"].includes(order.status),
  );

  return (
    <div className="space-y-5 pt-5">
      <div className="flex justify-end">
        <Button onClick={onNewDelivery}>
          <Plus />
          Novo delivery
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {deliveryOrders.map((order) => {
          const totals = calculateOrderTotals(order, data.products);
          const customer = data.customers.find(
            (candidate) => candidate.id === order.customerId,
          );

          return (
            <Card key={order.id}>
              <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_240px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">#{order.code}</Badge>
                    <Badge variant={orderStatusVariant(order.status)}>
                      {statusLabel[order.status]}
                    </Badge>
                    <Badge variant="neutral">
                      <Truck className="mr-1 size-3" />
                      {customer?.neighborhood ?? "Entrega"}
                    </Badge>
                    <Badge variant="neutral">
                      <Clock3 className="mr-1 size-3" />
                      {formatDuration(minutesSince(order.openedAt))}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm font-medium">
                    {customer?.name ?? "Cliente delivery"}
                  </p>
                  <div className="mt-3 grid gap-2">
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
                  <Row label="Total" value={formatCurrency(totals.total)} strong />
                  <Row label="Falta" value={formatCurrency(totals.remaining)} />
                  <Button
                    className="w-full"
                    size="sm"
                    variant="secondary"
                    disabled={order.status === "paid"}
                    onClick={() => onAdvance(order.id)}
                  >
                    <RefreshCw />
                    Avancar
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    disabled={totals.remaining <= 0}
                    onClick={() => onPay(order.id, "pix")}
                  >
                    <CreditCard />
                    Pagar Pix
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="ghost"
                    onClick={() => onSendWhatsApp(order.id)}
                  >
                    <Send />
                    WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {deliveryOrders.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum delivery aberto.
          </CardContent>
        </Card>
      )}
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
  const visibleOrders = orders.filter((order) => columns.includes(order.status));
  const averageMinutes =
    visibleOrders.length > 0
      ? Math.round(
          visibleOrders.reduce(
            (sum, order) => sum + minutesSince(order.openedAt),
            0,
          ) / visibleOrders.length,
        )
      : 0;

  return (
    <div className="space-y-4 pt-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Media dos pedidos"
          value={formatDuration(averageMinutes)}
          helper="Tempo medio dos pedidos em fila, preparo e pronto."
          icon={Timer}
          tone={averageMinutes > 30 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Mais antigo"
          value={formatDuration(
            visibleOrders.length
              ? Math.max(...visibleOrders.map((order) => minutesSince(order.openedAt)))
              : 0,
          )}
          helper="Ajuda a enxergar gargalos antes da reclamacao."
          icon={Clock3}
          tone="warning"
        />
        <MetricCard
          label="Pedidos ativos"
          value={String(visibleOrders.length)}
          helper="Fila operacional da cozinha neste momento."
          icon={ChefHat}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {columns.map((status) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle>{statusLabel[status]}</CardTitle>
              <CardDescription>Fila de producao por status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders
                .filter((order) => order.status === status)
                .map((order) => {
                  const elapsedMinutes = minutesSince(order.openedAt);

                  return (
                    <div
                      key={order.id}
                      className="rounded-lg border border-border bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="info">#{order.code}</Badge>
                        <div className="flex items-center gap-2">
                          <Badge variant={elapsedMinutes > 30 ? "warning" : "neutral"}>
                            <Clock3 className="mr-1 size-3" />
                            {formatDuration(elapsedMinutes)}
                          </Badge>
                          <Badge variant="neutral">{channelLabel[order.channel]}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        {order.items.map((item) => (
                          <p key={item.id}>{getItemLabel(item, data.products)}</p>
                        ))}
                      </div>
                      <Button
                        className="mt-4 w-full"
                        size="sm"
                        onClick={() => onAdvance(order.id)}
                      >
                        <ArrowUpRight />
                        {kitchenActionLabel(order.status)}
                      </Button>
                    </div>
                  );
                })}
              {!orders.some((order) => order.status === status) && (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Sem pedidos nesta coluna.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CatalogView({
  data,
  onAddProduct,
  onAddRecipeItem,
  onAddTable,
}: {
  data: SaboreData;
  onAddProduct: (form: ProductForm) => void;
  onAddRecipeItem: (form: RecipeForm) => void;
  onAddTable: (form: TableForm) => void;
}) {
  const [productForm, setProductForm] = useState<ProductForm>({
    name: "",
    category: "Pizzas",
    price: "",
    preparationArea: "kitchen",
  });
  const [recipeForm, setRecipeForm] = useState<RecipeForm>({
    productId: data.products.find((product) => product.active)?.id ?? "",
    ingredientId: data.ingredients[0]?.id ?? "",
    quantity: "",
  });
  const [tableForm, setTableForm] = useState<TableForm>({
    label: "",
    seats: "4",
  });
  const activeProducts = data.products.filter((product) => product.active);
  const selectedProductRecipe = data.recipe.filter(
    (item) => item.productId === recipeForm.productId,
  );

  function submitProduct() {
    onAddProduct(productForm);
    setProductForm((current) => ({ ...current, name: "", price: "" }));
  }

  function submitRecipeItem() {
    onAddRecipeItem(recipeForm);
    setRecipeForm((current) => ({ ...current, quantity: "" }));
  }

  function submitTable() {
    onAddTable(tableForm);
    setTableForm((current) => ({ ...current, label: "" }));
  }

  return (
    <div className="space-y-5 pt-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Itens do cardapio</CardTitle>
            <CardDescription>Cadastro rapido para colocar produto no PDV.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TextField
              label="Nome"
              value={productForm.name}
              onChange={(name) => setProductForm((current) => ({ ...current, name }))}
              placeholder="Pizza brotinho calabresa"
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <TextField
                label="Categoria"
                value={productForm.category}
                onChange={(category) =>
                  setProductForm((current) => ({ ...current, category }))
                }
              />
              <MoneyField
                label="Preco"
                value={productForm.price}
                onChange={(price) =>
                  setProductForm((current) => ({ ...current, price }))
                }
              />
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Praca
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
                value={productForm.preparationArea}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    preparationArea: event.target.value as Product["preparationArea"],
                  }))
                }
              >
                <option value="kitchen">Cozinha</option>
                <option value="bar">Bar</option>
                <option value="pastry">Confeitaria</option>
              </select>
            </label>
            <Button className="w-full" onClick={submitProduct}>
              <Plus />
              Adicionar no PDV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ficha tecnica</CardTitle>
            <CardDescription>Opcional para quem quer baixa automatica por receita.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="grid gap-2 text-sm font-medium">
              Produto
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
                value={recipeForm.productId}
                onChange={(event) =>
                  setRecipeForm((current) => ({
                    ...current,
                    productId: event.target.value,
                  }))
                }
              >
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px] xl:grid-cols-1">
              <label className="grid gap-2 text-sm font-medium">
                Insumo
                <select
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
                  value={recipeForm.ingredientId}
                  onChange={(event) =>
                    setRecipeForm((current) => ({
                      ...current,
                      ingredientId: event.target.value,
                    }))
                  }
                >
                  {data.ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.measure})
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Qtd."
                value={recipeForm.quantity}
                onChange={(quantity) =>
                  setRecipeForm((current) => ({ ...current, quantity }))
                }
                inputMode="decimal"
              />
            </div>
            <Button className="w-full" variant="secondary" onClick={submitRecipeItem}>
              <FilePenLine />
              Adicionar insumo
            </Button>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Receita atual
              </p>
              <div className="mt-2 space-y-2 text-sm">
                {selectedProductRecipe.map((item) => {
                  const ingredient = data.ingredients.find(
                    (candidate) => candidate.id === item.ingredientId,
                  );

                  return (
                    <Row
                      key={item.id}
                      label={ingredient?.name ?? "Insumo"}
                      value={`${item.quantity} ${ingredient?.measure ?? ""}`}
                    />
                  );
                })}
                {selectedProductRecipe.length === 0 && (
                  <p className="text-muted-foreground">Sem ficha tecnica cadastrada.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mesas e lugares</CardTitle>
            <CardDescription>Cadastre a quantidade fisica do salao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TextField
              label="Nome da mesa"
              value={tableForm.label}
              onChange={(label) => setTableForm((current) => ({ ...current, label }))}
              placeholder="Mesa 5"
            />
            <TextField
              label="Lugares"
              value={tableForm.seats}
              onChange={(seats) => setTableForm((current) => ({ ...current, seats }))}
              inputMode="numeric"
            />
            <Button className="w-full" onClick={submitTable}>
              <Table2 />
              Cadastrar mesa
            </Button>
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Mesas cadastradas
              </p>
              <div className="mt-2 space-y-2">
                <Row label="Total" value={String(data.tables.length)} strong />
                <Row
                  label="Lugares"
                  value={String(data.tables.reduce((sum, table) => sum + table.seats, 0))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StockView({
  positions,
  lots,
  data,
  dialog,
  onOpenDialog,
  onAdjustStock,
}: {
  positions: ReturnType<typeof calculateStockPositions>;
  lots: InventoryLot[];
  data: SaboreData;
  dialog: StockDialog;
  onOpenDialog: (dialog: StockDialog) => void;
  onAdjustStock: (form: StockAdjustmentForm) => boolean;
}) {
  const [stockForm, setStockForm] = useState<StockAdjustmentForm>({
    ingredientId: data.ingredients[0]?.id ?? "",
    quantity: "",
    direction: "in",
    reason: "compra",
    supplier: "Atacadao AL",
    batchCode: "",
    expiresAt: "2026-12-31",
  });

  function openMovement(direction: StockAdjustmentForm["direction"]) {
    setStockForm((current) => ({
      ...current,
      direction,
      reason:
        direction === "in"
          ? current.reason === "venda"
            ? "compra"
            : current.reason || "compra"
          : current.reason === "compra"
            ? "venda"
            : current.reason || "venda",
    }));
    onOpenDialog("movement");
  }

  function submitStockAdjustment() {
    if (onAdjustStock(stockForm)) {
      setStockForm((current) => ({ ...current, quantity: "", batchCode: "" }));
      onOpenDialog(null);
    }
  }

  return (
    <div className="space-y-5 pt-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Estoque</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entradas, baixas e validade ficam sob demanda para a tela respirar.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button onClick={() => openMovement("in")}>
            <Plus />
            Receber insumo
          </Button>
          <Button variant="outline" onClick={() => openMovement("out")}>
            <Minus />
            Dar baixa
          </Button>
          <Button variant="secondary" onClick={() => onOpenDialog("lots")}>
            <PackageCheck />
            Lotes e validade
          </Button>
        </div>
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

      {dialog === "movement" && (
        <ModalShell title="Movimentar estoque" onClose={() => onOpenDialog(null)}>
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium">
              Insumo
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
                value={stockForm.ingredientId}
                onChange={(event) =>
                  setStockForm((current) => ({
                    ...current,
                    ingredientId: event.target.value,
                  }))
                }
              >
                {data.ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name} ({ingredient.measure})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={stockForm.direction === "in" ? "secondary" : "outline"}
                onClick={() => openMovement("in")}
              >
                Entrada
              </Button>
              <Button
                variant={stockForm.direction === "out" ? "secondary" : "outline"}
                onClick={() => openMovement("out")}
              >
                Saida
              </Button>
            </div>
            <TextField
              label="Quantidade"
              value={stockForm.quantity}
              onChange={(quantity) =>
                setStockForm((current) => ({ ...current, quantity }))
              }
              inputMode="decimal"
            />
            <label className="grid gap-2 text-sm font-medium">
              Motivo
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none ring-ring transition focus:ring-2"
                value={stockForm.reason}
                onChange={(event) =>
                  setStockForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              >
                <option value="compra">Compra / recebimento</option>
                <option value="venda">Venda manual</option>
                <option value="improprio">Improprio para consumo</option>
                <option value="perda">Perda / quebra</option>
                <option value="contagem">Ajuste de contagem</option>
              </select>
            </label>
            {stockForm.direction === "in" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Fornecedor"
                  value={stockForm.supplier}
                  onChange={(supplier) =>
                    setStockForm((current) => ({ ...current, supplier }))
                  }
                />
                <TextField
                  label="Lote"
                  value={stockForm.batchCode}
                  onChange={(batchCode) =>
                    setStockForm((current) => ({ ...current, batchCode }))
                  }
                  placeholder="LOTE-001"
                />
                <TextField
                  label="Validade"
                  value={stockForm.expiresAt}
                  onChange={(expiresAt) =>
                    setStockForm((current) => ({ ...current, expiresAt }))
                  }
                  placeholder="2026-12-31"
                />
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenDialog(null)}>
                Cancelar
              </Button>
              <Button onClick={submitStockAdjustment}>
                <PackageCheck />
                Registrar movimento
              </Button>
            </div>
          </div>
        </ModalShell>
      )}

      {dialog === "lots" && (
        <ModalShell title="Lotes e validade" wide onClose={() => onOpenDialog(null)}>
          <p className="mb-4 text-sm text-muted-foreground">
            Controle FEFO para reduzir perda de pereciveis.
          </p>
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
                      <td className="font-mono text-xs text-muted-foreground">
                        {lot.batchCode}
                      </td>
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
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        className={cn(
          "max-h-[88vh] w-full overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-xl",
          wide ? "max-w-4xl" : "max-w-xl",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}>
            <X />
          </Button>
        </div>
        {children}
      </div>
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
              <CheckCircle2 className="size-4 text-emerald-700" />
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

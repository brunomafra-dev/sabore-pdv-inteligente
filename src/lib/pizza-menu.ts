import type { Product } from "./types";

export type PizzaSizeId = "media" | "grande" | "familia";

export interface PizzaSize {
  id: PizzaSizeId;
  label: string;
  diameter: string;
  slices: number;
  baseProductName: string;
}

export interface PizzaFlavor {
  id: string;
  name: string;
  ingredients: string;
  prices: Record<PizzaSizeId, number>;
}

export interface PizzaTopping {
  id: string;
  name: string;
  type: "borda" | "extra";
  prices: Record<PizzaSizeId, number>;
}

export interface PizzaBuilderState {
  sizeId: PizzaSizeId;
  flavorIds: string[];
  toppingIds: string[];
}

export interface BuiltPizza {
  productId: string;
  name: string;
  unitPrice: number;
  notes: string;
}

export const pizzaSizes: PizzaSize[] = [
  {
    id: "media",
    label: "Media",
    diameter: "30 cm",
    slices: 6,
    baseProductName: "Pizza media - monte sua (30cm)",
  },
  {
    id: "grande",
    label: "Grande",
    diameter: "35 cm",
    slices: 8,
    baseProductName: "Pizza grande - monte sua (35cm)",
  },
  {
    id: "familia",
    label: "Familia",
    diameter: "40 cm",
    slices: 10,
    baseProductName: "Pizza familia - monte sua (40cm)",
  },
];

export const pizzaFlavors: PizzaFlavor[] = [
  {
    id: "marguerita",
    name: "Marguerita",
    ingredients: "Mussarela, tomate, manjericao e molho da casa",
    prices: { media: 48, grande: 62, familia: 76 },
  },
  {
    id: "calabresa",
    name: "Calabresa",
    ingredients: "Calabresa artesanal, cebola roxa, mussarela e oregano",
    prices: { media: 50, grande: 64, familia: 78 },
  },
  {
    id: "frango-catupiry",
    name: "Frango com catupiry",
    ingredients: "Frango desfiado, catupiry, milho, mussarela e oregano",
    prices: { media: 54, grande: 68, familia: 84 },
  },
  {
    id: "portuguesa",
    name: "Portuguesa",
    ingredients: "Presunto, ovo, cebola, pimentao, azeitona e mussarela",
    prices: { media: 55, grande: 70, familia: 86 },
  },
  {
    id: "quatro-queijos",
    name: "Quatro queijos",
    ingredients: "Mussarela, parmesao, provolone, gorgonzola e oregano",
    prices: { media: 58, grande: 74, familia: 92 },
  },
  {
    id: "pepperoni",
    name: "Pepperoni",
    ingredients: "Pepperoni, mussarela, molho rustico e oregano",
    prices: { media: 60, grande: 78, familia: 96 },
  },
];

export const pizzaToppings: PizzaTopping[] = [
  {
    id: "borda-catupiry",
    name: "Borda catupiry",
    type: "borda",
    prices: { media: 9, grande: 12, familia: 15 },
  },
  {
    id: "borda-cheddar",
    name: "Borda cheddar",
    type: "borda",
    prices: { media: 9, grande: 12, familia: 15 },
  },
  {
    id: "bacon-extra",
    name: "Bacon extra",
    type: "extra",
    prices: { media: 6, grande: 8, familia: 10 },
  },
  {
    id: "catupiry-extra",
    name: "Catupiry extra",
    type: "extra",
    prices: { media: 6, grande: 8, familia: 10 },
  },
  {
    id: "cebola-caramelizada",
    name: "Cebola caramelizada",
    type: "extra",
    prices: { media: 5, grande: 7, familia: 9 },
  },
];

export function createDefaultPizzaBuilder(): PizzaBuilderState {
  return {
    sizeId: "grande",
    flavorIds: ["calabresa"],
    toppingIds: [],
  };
}

export function getPizzaSize(sizeId: PizzaSizeId) {
  return pizzaSizes.find((size) => size.id === sizeId) ?? pizzaSizes[1];
}

export function getPizzaFlavor(flavorId: string) {
  return pizzaFlavors.find((flavor) => flavor.id === flavorId);
}

export function getPizzaTopping(toppingId: string) {
  return pizzaToppings.find((topping) => topping.id === toppingId);
}

export function calculatePizzaPrice(builder: PizzaBuilderState) {
  const flavorPrice = builder.flavorIds.reduce((sum, flavorId) => {
    const flavor = getPizzaFlavor(flavorId);

    return sum + (flavor?.prices[builder.sizeId] ?? 0) / builder.flavorIds.length;
  }, 0);
  const toppingsPrice = builder.toppingIds.reduce((sum, toppingId) => {
    const topping = getPizzaTopping(toppingId);

    return sum + (topping?.prices[builder.sizeId] ?? 0);
  }, 0);

  return flavorPrice + toppingsPrice;
}

export function resolvePizzaBaseProduct(
  products: Product[],
  sizeId: PizzaSizeId,
) {
  const size = getPizzaSize(sizeId);

  return (
    products.find((product) => product.name === size.baseProductName) ??
    products.find(
      (product) =>
        product.category === "Pizzas" &&
        product.name.toLowerCase().includes(size.label.toLowerCase()),
    )
  );
}

export function buildPizzaItem(
  builder: PizzaBuilderState,
  products: Product[],
): BuiltPizza | null {
  const size = getPizzaSize(builder.sizeId);
  const baseProduct = resolvePizzaBaseProduct(products, builder.sizeId);
  const flavors = builder.flavorIds
    .map((flavorId) => getPizzaFlavor(flavorId))
    .filter((flavor): flavor is PizzaFlavor => Boolean(flavor));
  const toppings = builder.toppingIds
    .map((toppingId) => getPizzaTopping(toppingId))
    .filter((topping): topping is PizzaTopping => Boolean(topping));

  if (!baseProduct || flavors.length === 0) return null;

  const flavorLabel =
    flavors.length === 1
      ? flavors[0].name
      : `1/2 ${flavors[0].name} + 1/2 ${flavors[1].name}`;
  const toppingLabel =
    toppings.length > 0 ? toppings.map((topping) => topping.name).join(", ") : "Sem adicionais";

  return {
    productId: baseProduct.id,
    name: `${size.label} ${size.diameter} ${flavorLabel}`,
    unitPrice: calculatePizzaPrice(builder),
    notes: `${size.slices} fatias. ${toppingLabel}.`,
  };
}

import type { Product } from "./types";

export type PizzaSizeId = "brotinho" | "grande";

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
    id: "brotinho",
    label: "Brotinho",
    diameter: "individual",
    slices: 4,
    baseProductName: "Pizza brotinho - monte sua",
  },
  {
    id: "grande",
    label: "Grande",
    diameter: "8 fatias",
    slices: 8,
    baseProductName: "Pizza grande - monte sua",
  },
];

export const pizzaFlavors: PizzaFlavor[] = [
  {
    id: "mussarela",
    name: "Mussarela",
    ingredients: "Molho de tomate, queijo mussarela, azeitonas e oregano",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "dois-queijos",
    name: "Dois queijos",
    ingredients: "Molho de tomate, mussarela, catupiry e oregano",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "marguerita",
    name: "Margheritta",
    ingredients: "Molho de tomate, mussarela, tomate, manjericao e oregano",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "mista",
    name: "Mista",
    ingredients: "Molho de tomate, mussarela, presunto, tomate e oregano",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "milho-verde",
    name: "Milho verde",
    ingredients: "Mussarela, molho de tomate, milho verde, tomate e oregano",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "calabresa",
    name: "Calabresa",
    ingredients: "Molho de tomate, mussarela, calabresa, cebola, azeitona e oregano",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "portuguesa",
    name: "Portuguesa",
    ingredients: "Molho de tomate, mussarela, cebola, milho verde, azeitona, ovos, presunto, pimentao e oregano",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "cartola",
    name: "Cartola",
    ingredients: "Mussarela, banana, acucar e canela em po",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "banana-doce-leite",
    name: "Banana com doce de leite",
    ingredients: "Mussarela, banana e doce de leite",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "chocolate-morango",
    name: "Chocolate com morango",
    ingredients: "Mussarela, chocolate Nestle e morango fatiado",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "chocolate-banana",
    name: "Chocolate com banana",
    ingredients: "Mussarela, chocolate Nestle e banana fatiada",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "brigadeiro",
    name: "Brigadeiro",
    ingredients: "Mussarela, chocolate Nestle e granulado",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "romeu-julieta",
    name: "Romeu e Julieta",
    ingredients: "Mussarela, goiabada e catupiry",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "banana-nevada",
    name: "Banana nevada",
    ingredients: "Mussarela, banana, acucar, canela em po e chocolate branco",
    prices: { brotinho: 20, grande: 45 },
  },
  {
    id: "frango-catupiry",
    name: "Frango com catupiry",
    ingredients: "Molho de tomate, mussarela, frango desfiado, catupiry e oregano",
    prices: { brotinho: 25, grande: 50 },
  },
  {
    id: "frango-caipira",
    name: "Frango caipira",
    ingredients: "Molho de tomate, mussarela, frango desfiado, bacon, milho verde e oregano",
    prices: { brotinho: 25, grande: 50 },
  },
  {
    id: "baiana",
    name: "Baiana",
    ingredients: "Molho de tomate, mussarela, calabresa, pimenta calabresa, cebola e oregano",
    prices: { brotinho: 25, grande: 50 },
  },
  {
    id: "quatro-queijos",
    name: "Quatro queijos",
    ingredients: "Molho de tomate, mussarela, provolone, parmesao, catupiry e oregano",
    prices: { brotinho: 25, grande: 50 },
  },
  {
    id: "lombo-catupiry",
    name: "Lombo catupiry",
    ingredients: "Molho de tomate, mussarela, lombo defumado, catupiry e oregano",
    prices: { brotinho: 25, grande: 50 },
  },
  {
    id: "catupirela",
    name: "Catupirela",
    ingredients: "Molho de tomate, mussarela, calabresa, catupiry, cebola e oregano",
    prices: { brotinho: 25, grande: 50 },
  },
  {
    id: "atum",
    name: "Atum",
    ingredients: "Molho de tomate, mussarela, atum ralado, cebola e oregano",
    prices: { brotinho: 25, grande: 50 },
  },
  {
    id: "dos-nunes",
    name: "Dos Nunes",
    ingredients: "Molho de tomate, mussarela, file de alcatra em cubos, catupiry e oregano",
    prices: { brotinho: 25, grande: 52 },
  },
  {
    id: "file-barbecue",
    name: "File barbecue",
    ingredients: "Molho de tomate, mussarela, file de alcatra em cubos, tomate, catupiry, barbecue e oregano",
    prices: { brotinho: 25, grande: 52 },
  },
  {
    id: "carne-sol",
    name: "Carne de sol",
    ingredients: "Molho de tomate, mussarela, carne de sol, tomate, cebola e oregano",
    prices: { brotinho: 25, grande: 52 },
  },
  {
    id: "frango-catupiry-bacon",
    name: "Frango com catupiry e bacon",
    ingredients: "Molho de tomate, mussarela, frango desfiado, bacon em cubos e catupiry",
    prices: { brotinho: 25, grande: 52 },
  },
  {
    id: "sertaneja",
    name: "Sertaneja",
    ingredients: "Molho de tomate, mussarela, carne de sol desfiada, cebola, queijo coalho e oregano",
    prices: { brotinho: 25, grande: 52 },
  },
];

export const pizzaToppings: PizzaTopping[] = [];

export function createDefaultPizzaBuilder(): PizzaBuilderState {
  return {
    sizeId: "grande",
    flavorIds: ["mussarela"],
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
  const flavorPrices = builder.flavorIds.map((flavorId) => {
    const flavor = getPizzaFlavor(flavorId);

    return flavor?.prices[builder.sizeId] ?? 0;
  });
  const flavorPrice = Math.max(0, ...flavorPrices);
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
    ) ??
    products.find((product) => product.category === "Pizzas")
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

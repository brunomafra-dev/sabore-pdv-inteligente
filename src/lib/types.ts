export type Role = "owner" | "manager" | "cashier" | "kitchen" | "stock";

export type SalesChannel = "counter" | "table" | "delivery";

export type OrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "delivered"
  | "paid"
  | "cancelled";

export type PaymentMethod =
  | "cash"
  | "pix"
  | "credit"
  | "debit"
  | "voucher"
  | "online";

export type FiscalStatus = "disabled" | "pending" | "authorized" | "rejected";

export type InventoryMovementType =
  | "receipt"
  | "sale"
  | "production"
  | "count_adjustment"
  | "waste"
  | "manual_exit";

export type UnitMeasure = "g" | "kg" | "ml" | "l" | "un";

export interface Organization {
  id: string;
  name: string;
  planPrice: number;
}

export interface RestaurantUnit {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  neighborhood: string;
  fiscalEnabled: boolean;
}

export interface UserProfile {
  id: string;
  unitId: string;
  name: string;
  role: Role;
}

export interface DiningTable {
  id: string;
  unitId: string;
  label: string;
  seats: number;
  status: "free" | "open" | "closing";
}

export interface Customer {
  id: string;
  unitId: string;
  name: string;
  phone: string;
  neighborhood?: string;
}

export interface Ingredient {
  id: string;
  unitId: string;
  name: string;
  measure: UnitMeasure;
  averageCost: number;
  minimumStock: number;
}

export interface InventoryLot {
  id: string;
  ingredientId: string;
  supplier: string;
  batchCode: string;
  quantity: number;
  expiresAt: string;
  receivedAt: string;
}

export interface Product {
  id: string;
  unitId: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
  preparationArea: "kitchen" | "bar" | "pastry";
}

export interface RecipeItem {
  id: string;
  productId: string;
  ingredientId: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  notes?: string;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  receivedAt: string;
  externalId?: string;
}

export interface Order {
  id: string;
  unitId: string;
  code: string;
  channel: SalesChannel;
  status: OrderStatus;
  openedAt: string;
  tableId?: string;
  customerId?: string;
  items: OrderItem[];
  deliveryFee: number;
  discount: number;
  payments: Payment[];
  fiscalStatus: FiscalStatus;
  whatsappStatus: "not_sent" | "queued" | "sent" | "failed";
}

export interface CashSession {
  id: string;
  unitId: string;
  openedBy: string;
  openedAt: string;
  openingAmount: number;
  expectedAmount: number;
  status: "open" | "closed";
}

export interface InventoryMovement {
  id: string;
  unitId: string;
  ingredientId: string;
  type: InventoryMovementType;
  quantity: number;
  costImpact: number;
  reason: string;
  createdAt: string;
  orderId?: string;
}

export interface WhatsAppTemplate {
  id: string;
  unitId: string;
  name: string;
  category: "utility" | "marketing" | "service";
  status: "draft" | "approved" | "rejected";
  monthlyPrice?: number;
}

export interface SaboreData {
  organization: Organization;
  unit: RestaurantUnit;
  users: UserProfile[];
  tables: DiningTable[];
  customers: Customer[];
  ingredients: Ingredient[];
  lots: InventoryLot[];
  products: Product[];
  recipe: RecipeItem[];
  orders: Order[];
  cashSession: CashSession;
  movements: InventoryMovement[];
  whatsappTemplates: WhatsAppTemplate[];
}

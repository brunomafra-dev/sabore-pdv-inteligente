import { z } from "zod";

export const fiscalItemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  ncm: z.string().optional(),
  cfop: z.string().optional(),
});

export const fiscalCustomerSchema = z.object({
  name: z.string().optional(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
});

export const issueNfceSchema = z.object({
  unitId: z.string().min(1),
  orderId: z.string().min(1),
  reference: z.string().min(1),
  customer: fiscalCustomerSchema.optional(),
  items: z.array(fiscalItemSchema).min(1),
  payments: z.array(
    z.object({
      method: z.string().min(1),
      amount: z.number().positive(),
    }),
  ),
  delivery: z.boolean().default(false),
  total: z.number().positive(),
});

export const createPaymentSchema = z.object({
  unitId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["pix", "card"]),
  customerEmail: z.string().email().optional(),
});

export const whatsappTemplateSchema = z.object({
  unitId: z.string().min(1),
  to: z.string().min(8),
  templateName: z.string().min(1),
  parameters: z.record(z.string(), z.string()).default({}),
});

export type IssueNfceInput = z.infer<typeof issueNfceSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type WhatsAppTemplateInput = z.infer<typeof whatsappTemplateSchema>;

export interface FiscalResult {
  provider: "focus-nfe" | "mock";
  status: "authorized" | "rejected" | "queued";
  reference: string;
  accessKey?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  rejectionReason?: string;
}

export interface PaymentResult {
  provider: "mercado-pago" | "mock";
  status: "pending" | "approved" | "rejected";
  externalId: string;
  qrCode?: string;
  checkoutUrl?: string;
}

export interface WhatsAppResult {
  provider: "whatsapp-cloud" | "mock";
  status: "queued" | "sent" | "failed";
  messageId?: string;
}

export interface FiscalProvider {
  issueNfce(input: IssueNfceInput): Promise<FiscalResult>;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
}

export interface WhatsAppProvider {
  sendTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppResult>;
}

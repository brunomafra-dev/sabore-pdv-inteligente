import type {
  FiscalProvider,
  FiscalResult,
  IssueNfceInput,
} from "./contracts";

export class MockFiscalProvider implements FiscalProvider {
  async issueNfce(input: IssueNfceInput): Promise<FiscalResult> {
    return {
      provider: "mock",
      status: "authorized",
      reference: input.reference,
      accessKey: `MOCK-${input.reference}`,
      pdfUrl: `/api/fiscal/nfce/mock/${input.reference}.pdf`,
      xmlUrl: `/api/fiscal/nfce/mock/${input.reference}.xml`,
    };
  }
}

export class FocusNfeProvider implements FiscalProvider {
  constructor(
    private readonly token: string,
    private readonly baseUrl = "https://api.focusnfe.com.br/v2",
  ) {}

  async issueNfce(input: IssueNfceInput): Promise<FiscalResult> {
    const body = {
      natureza_operacao: "VENDA AO CONSUMIDOR",
      presenca_comprador: input.delivery ? "4" : "1",
      local_destino: "1",
      modalidade_frete: "9",
      indicador_inscricao_estadual_destinatario: "9",
      items: input.items.map((item) => ({
        codigo: item.sku,
        descricao: item.name,
        quantidade_comercial: item.quantity,
        valor_unitario_comercial: item.unitPrice,
        ncm: item.ncm ?? "21069090",
        cfop: item.cfop ?? "5102",
      })),
      formas_pagamento: input.payments.map((payment) => ({
        forma_pagamento: payment.method,
        valor_pagamento: payment.amount,
      })),
      nome_destinatario: input.customer?.name,
      cpf_destinatario: input.customer?.cpf,
    };
    const response = await fetch(
      `${this.baseUrl}/nfce?ref=${encodeURIComponent(input.reference)}&completa=1`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.token}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        provider: "focus-nfe",
        status: "rejected",
        reference: input.reference,
        rejectionReason:
          typeof data.mensagem === "string"
            ? data.mensagem
            : `Focus NFe HTTP ${response.status}`,
      };
    }

    return {
      provider: "focus-nfe",
      status: "authorized",
      reference: input.reference,
      accessKey: String(data.chave_nfe ?? ""),
      pdfUrl: typeof data.caminho_danfe === "string" ? data.caminho_danfe : undefined,
      xmlUrl: typeof data.caminho_xml_nota_fiscal === "string" ? data.caminho_xml_nota_fiscal : undefined,
    };
  }
}

export function getFiscalProvider(): FiscalProvider {
  const token = process.env.FOCUS_NFE_TOKEN;

  return token ? new FocusNfeProvider(token) : new MockFiscalProvider();
}

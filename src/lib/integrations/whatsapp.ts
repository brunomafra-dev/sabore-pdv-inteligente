import type {
  WhatsAppProvider,
  WhatsAppResult,
  WhatsAppTemplateInput,
} from "./contracts";

export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppResult> {
    return {
      provider: "mock",
      status: "queued",
      messageId: `mock-wa-${input.templateName}-${Date.now()}`,
    };
  }
}

export class WhatsAppCloudProvider implements WhatsAppProvider {
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly graphVersion = "v22.0",
  ) {}

  async sendTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppResult> {
    const response = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to,
          type: "template",
          template: {
            name: input.templateName,
            language: { code: "pt_BR" },
            components: Object.values(input.parameters).length
              ? [
                  {
                    type: "body",
                    parameters: Object.values(input.parameters).map((text) => ({
                      type: "text",
                      text,
                    })),
                  },
                ]
              : [],
          },
        }),
      },
    );
    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };

    return {
      provider: "whatsapp-cloud",
      status: response.ok ? "sent" : "failed",
      messageId: data.messages?.[0]?.id,
    };
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  return token && phoneNumberId
    ? new WhatsAppCloudProvider(token, phoneNumberId)
    : new MockWhatsAppProvider();
}

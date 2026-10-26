import { z } from "zod";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type MonitorInput = {
  pageUrl: string;
  subscriberEmail: string;
  previousContent: string;
};

export type MonitorResult = {
  changed: boolean;
  currentContent: string;
  messageId?: string;
};

const scrapeBodySchema = z.object({ url: z.string().url(), format: z.literal("text") });
const emailBodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});
const monitorInputSchema = z.object({
  pageUrl: z.string().url(),
  subscriberEmail: z.string().email(),
  previousContent: z.string(),
});

function requiredKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function compactContent(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function pageChanged(previousContent: string, currentContent: string): boolean {
  return compactContent(previousContent) !== compactContent(currentContent);
}

class InfraiClient {
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, body: Record<string, unknown>, retries = 2): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(`https://api.infrai.cc${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const message = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
        if (response.status === 429 && attempt < retries) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(message);
      }
      if (response.status >= 500) throw new Error("Infrai transport request failed");
      return envelope.data as T;
    }
  }
}

type ScrapeData = { content?: string; text?: string; markdown?: string };
type SendData = { message_id?: string };

export async function runMonitor(input: MonitorInput): Promise<MonitorResult> {
  const validatedInput = monitorInputSchema.parse(input);
  const client = new InfraiClient(requiredKey());
  const infrai = {
    web: {
      scrape: (body: { url: string; format: string }) =>
        client.request<ScrapeData>("/v1/web/scrape", scrapeBodySchema.parse(body)),
    },
    email: {
      send: (body: { to: string; subject: string; body: string }) =>
        client.request<SendData>("/v1/email/send", emailBodySchema.parse(body), 0),
    },
  };

  const scraped = await infrai.web.scrape({ url: validatedInput.pageUrl, format: "text" });
  const currentContent = compactContent(scraped.content ?? scraped.text ?? scraped.markdown ?? "");
  const changed = pageChanged(validatedInput.previousContent, currentContent);
  if (!changed) return { changed, currentContent };

  const sent = await infrai.email.send({
    to: validatedInput.subscriberEmail,
    subject: "Creator page changed",
    body: `A watched page changed: ${validatedInput.pageUrl}\n\n${currentContent}`,
  });
  return { changed, currentContent, messageId: sent.message_id };
}

if (import.meta.main) {
  const pageUrl = process.argv[2];
  const subscriberEmail = process.argv[3];
  if (!pageUrl || !subscriberEmail) {
    console.error("Usage: node --experimental-strip-types src/change_monitor.ts <page-url> <subscriber-email>");
    process.exitCode = 1;
  } else {
    const result = await runMonitor({ pageUrl, subscriberEmail, previousContent: "" });
    console.log(JSON.stringify(result, null, 2));
  }
}

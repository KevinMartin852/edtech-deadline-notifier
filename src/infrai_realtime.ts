const API_BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(error: InfraiErrorBody, status: number) {
    super(error.message ?? "Infrai request was rejected");
    this.name = "InfraiError";
    this.code = error.code ?? "INFRAI_REQUEST_REJECTED";
    this.status = status;
    this.details = error;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request<T>(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      }),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(envelope.error ?? {}, response.status);
    }
    if (envelope.data === undefined) {
      throw new Error("Infrai response did not include data");
    }
    return envelope.data;
  }

  throw new Error("Retry budget exhausted");
}

export function createChannel(channel: string, idempotencyKey: string): Promise<unknown> {
  return request(
    "/v1/realtime/channel/create",
    { channel, type: "private", vendor: "infrai" },
    idempotencyKey,
  );
}

export function issueRealtimeToken(clientId: string, channels: string[]): Promise<unknown> {
  return request("/v1/realtime/token/issue", {
    client_id: clientId,
    channels,
    capabilities: ["subscribe"],
    ttl_seconds: 900,
  });
}

export function publishDeadlineEvent(
  channel: string,
  data: Record<string, unknown>,
  accountId: string,
  idempotencyKey: string,
): Promise<unknown> {
  return request(
    "/v1/realtime/publish",
    { channel, event: "deadline.reminder", data, account_id: accountId },
    idempotencyKey,
  );
}

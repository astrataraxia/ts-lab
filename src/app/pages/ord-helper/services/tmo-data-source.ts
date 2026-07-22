import type { TmoSnapshot } from "../types";

export const TMO_DATAS_ENDPOINT = "http://127.0.0.1:25625/datas";
export const TMO_POLL_INTERVAL = 2_000;

type TmoPayload = {
  units?: unknown;
  banned?: unknown;
};

type TmoDataSourceOptions = {
  endpoint?: string;
  interval?: number;
};

type TmoDataSourceHandlers = {
  onSnapshot: (snapshot: TmoSnapshot) => void;
  onError: (message: string) => void;
};

export function createTmoDataSource(options: TmoDataSourceOptions = {}) {
  const endpoint = options.endpoint ?? TMO_DATAS_ENDPOINT;
  const interval = options.interval ?? TMO_POLL_INTERVAL;

  return {
    start(handlers: TmoDataSourceHandlers) {
      let stopped = false;
      let timer: number | undefined;

      const poll = async () => {
        const abortController = new AbortController();
        const timeout = window.setTimeout(() => abortController.abort(), 1_500);

        try {
          const response = await fetch(endpoint, {
            signal: abortController.signal,
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(`TMO.GG 응답 오류 (${response.status})`);
          }

          const payload = parsePayload(await response.text());

          if (!stopped) {
            handlers.onSnapshot({
              units: normalizeUnits(payload.units),
              banned: normalizeBanned(payload.banned),
              receivedAt: Date.now(),
            });
          }
        } catch (error) {
          if (
            !stopped &&
            !(error instanceof DOMException && error.name === "AbortError")
          ) {
            handlers.onError(getErrorMessage(error));
          }
        } finally {
          window.clearTimeout(timeout);

          if (!stopped) {
            timer = window.setTimeout(poll, interval);
          }
        }
      };

      void poll();

      return () => {
        stopped = true;

        if (timer !== undefined) {
          window.clearTimeout(timer);
        }
      };
    },
  };
}

function parsePayload(text: string): TmoPayload {
  try {
    const payload: unknown = JSON.parse(text);

    if (isRecord(payload)) {
      return payload;
    }
  } catch {
    const unitsMatch = text.match(/"units"\s*:\s*({[\s\S]*?})\s*,\s*"banned"/);

    if (unitsMatch) {
      try {
        return {
          units: JSON.parse(unitsMatch[1]),
        };
      } catch {
        // The next poll will retry once the desktop response is complete.
      }
    }
  }

  throw new Error("TMO.GG 응답을 읽을 수 없습니다.");
}

function normalizeUnits(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([id, count]) => {
      const normalizedCount = normalizeCount(count);
      return normalizedCount === null ? [] : [[id, normalizedCount]];
    }),
  );
}

function normalizeBanned(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
}

function normalizeCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "TMO.GG에 연결할 수 없습니다.";
}

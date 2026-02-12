/**
 * Logger: in production only errors are logged (once for repeated messages).
 * In development, all levels are logged to the console.
 * Use this to keep production console clean and app ready for many users.
 */
const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";

const seen = new Set<string>();
const seenKey = (msg: string, key?: string) => key ?? msg;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (isDev) console.warn(msg, ...args);
    else {
      const k = seenKey(msg, args[0] as string);
      if (!seen.has(k)) {
        seen.add(k);
        console.warn(msg, ...args);
      }
    }
  },
  error: (msg: string, ...args: unknown[]) => {
    const k = seenKey(msg, args[0] as string);
    if (isDev) console.error(msg, ...args);
    else if (!seen.has(k)) {
      seen.add(k);
      console.error(msg, ...args);
    }
  },
  /** Use for one-off dev-only debug (realtime, etc.) */
  dev: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
};

import type { AbstractIntlMessages } from "next-intl";

/** Returns a shallow copy of the message catalogue keeping only the namespaces that pass `keep`. */
export function pick(messages: AbstractIntlMessages, keep: (namespace: string) => boolean): AbstractIntlMessages {
  return Object.fromEntries(Object.entries(messages).filter(([key]) => keep(key)));
}

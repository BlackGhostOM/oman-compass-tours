"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmOptions = { title: string; body?: ReactNode; items?: string[]; confirm: string; cancel: string; danger?: boolean };

/**
 * A promise-based confirmation for staff actions that bypass a rule (forced status, overbooking): render `dialog`
 * once, then `if (await confirm({...}))`. Resolves false when dismissed.
 */
export function useConfirm(): [ReactNode, (opts: ConfirmOptions) => Promise<boolean>] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  const dialog = (
    <AlertDialog open={opts !== null} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
          {(opts?.body || opts?.items?.length) && (
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-start">
                {opts?.body && <p>{opts.body}</p>}
                {opts?.items && opts.items.length > 0 && <ul className="list-disc space-y-1 ps-5">{opts.items.map((x) => <li key={x}>{x}</li>)}</ul>}
              </div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{opts?.cancel}</AlertDialogCancel>
          <AlertDialogAction variant={opts?.danger ? "destructive" : "default"} onClick={() => close(true)}>{opts?.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [dialog, confirm];
}

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

export type PromptOptions = {
  title?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
};

type ConfirmResolver = (v: boolean) => void;
type PromptResolver = (v: string | null) => void;

type Ctx = {
  confirm: (opts?: ConfirmOptions) => Promise<boolean>;
  prompt: (opts?: PromptOptions) => Promise<string | null>;
};

const Ctx = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";

  // confirm state
  const [cOpen, setCOpen] = useState(false);
  const [cOpts, setCOpts] = useState<ConfirmOptions>({});
  const cRes = useRef<ConfirmResolver | null>(null);

  const confirm = useCallback((o: ConfirmOptions = {}) => {
    setCOpts(o);
    setCOpen(true);
    return new Promise<boolean>((res) => { cRes.current = res; });
  }, []);
  const cFinish = (v: boolean) => {
    setCOpen(false);
    cRes.current?.(v);
    cRes.current = null;
  };
  const destructive = cOpts.variant === "destructive";

  // prompt state
  const [pOpen, setPOpen] = useState(false);
  const [pOpts, setPOpts] = useState<PromptOptions>({});
  const [pValue, setPValue] = useState("");
  const pRes = useRef<PromptResolver | null>(null);

  const prompt = useCallback((o: PromptOptions = {}) => {
    setPOpts(o);
    setPValue(o.defaultValue ?? "");
    setPOpen(true);
    return new Promise<string | null>((res) => { pRes.current = res; });
  }, []);
  const pFinish = (v: string | null) => {
    setPOpen(false);
    pRes.current?.(v);
    pRes.current = null;
  };
  const pSubmit = () => {
    const v = pValue.trim();
    if (pOpts.required && !v) return;
    pFinish(v);
  };

  const value = useMemo<Ctx>(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <Ctx.Provider value={value}>
      {children}

      <AlertDialog open={cOpen} onOpenChange={(v) => { if (!v) cFinish(false); }}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {destructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {cOpts.title ?? (ar ? "تأكيد" : "Confirm")}
            </AlertDialogTitle>
            {cOpts.description && (
              <AlertDialogDescription className="whitespace-pre-line">
                {cOpts.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => cFinish(false)}>
              {cOpts.cancelText ?? (ar ? "إلغاء" : "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cFinish(true)}
              className={cn(destructive && buttonVariants({ variant: "destructive" }))}
            >
              {cOpts.confirmText ?? (ar ? "تأكيد" : "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pOpen} onOpenChange={(v) => { if (!v) pFinish(null); }}>
        <DialogContent dir={dir} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pOpts.title ?? (ar ? "إدخال" : "Enter value")}</DialogTitle>
            {pOpts.description && (
              <DialogDescription className="whitespace-pre-line">
                {pOpts.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <Input
            autoFocus
            value={pValue}
            placeholder={pOpts.placeholder}
            onChange={(e) => setPValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pSubmit(); } }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => pFinish(null)}>
              {pOpts.cancelText ?? (ar ? "إلغاء" : "Cancel")}
            </Button>
            <Button onClick={pSubmit} disabled={pOpts.required ? !pValue.trim() : false}>
              {pOpts.confirmText ?? (ar ? "موافق" : "OK")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrompt must be used within <ConfirmProvider>");
  return ctx.prompt;
}

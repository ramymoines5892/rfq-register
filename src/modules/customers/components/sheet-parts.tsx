/**
 * Presentational sub-components used by the Customer sheet.
 *
 * Extracted from `routes/_authenticated/customers.tsx` (Phase 3).
 * Pure — no data fetching, no mutations; parents own state.
 */

import type { ReactNode } from "react";
import {
  UserRound,
  Landmark,
  Star,
  Trash2,
  Download,
  File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { BilingualInputs } from "@/lib/bilingual";
import type { Bank, Contact } from "../types";
import { CURRENCIES, formatBytes } from "../types";

export function SectionTitle({
  icon,
  title,
  subtitle,
  count,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0 text-start">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {count}
            </Badge>
          )}
        </div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground truncate font-normal">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  icon,
  className,
  children,
}: {
  label: ReactNode;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

export function ContactRow({
  contact,
  onChange,
  onDelete,
}: {
  contact: Contact;
  onChange: (patch: Partial<Contact>) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="border-s-4 border-s-primary/60">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <UserRound className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
          <div className="flex-1 space-y-3">
            <BilingualInputs
              label={t("contactName")}
              valueAr={contact.name_ar ?? ""}
              valueEn={contact.name_en ?? ""}
              onChangeAr={(v) => onChange({ name_ar: v })}
              onChangeEn={(v) => onChange({ name_en: v })}
              maxLength={150}
            />
            <BilingualInputs
              label={t("jobTitle")}
              valueAr={contact.title_ar ?? ""}
              valueEn={contact.title_en ?? ""}
              onChangeAr={(v) => onChange({ title_ar: v })}
              onChangeEn={(v) => onChange({ title_en: v })}
              maxLength={150}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="email"
                dir="ltr"
                placeholder={t("email")}
                value={contact.email ?? ""}
                onChange={(e) => onChange({ email: e.target.value })}
              />
              <Input
                dir="ltr"
                placeholder={t("phone")}
                value={contact.phone ?? ""}
                onChange={(e) => onChange({ phone: e.target.value })}
              />
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs ps-6">
          <Switch checked={contact.is_primary} onCheckedChange={(v) => onChange({ is_primary: v })} />
          <Star className="h-3.5 w-3.5" />
          {t("primary")}
        </div>
      </CardContent>
    </Card>
  );
}

export function BankRow({
  bank,
  onChange,
  onDelete,
}: {
  bank: Bank;
  onChange: (patch: Partial<Bank>) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="border-s-4 border-s-accent">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <Landmark className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
          <div className="flex-1 space-y-3">
            <BilingualInputs
              label={t("bankName")}
              valueAr={bank.bank_name_ar ?? ""}
              valueEn={bank.bank_name_en ?? ""}
              onChangeAr={(v) => onChange({ bank_name_ar: v })}
              onChangeEn={(v) => onChange({ bank_name_en: v })}
              maxLength={150}
            />
            <BilingualInputs
              label={t("accountName")}
              valueAr={bank.account_name_ar ?? ""}
              valueEn={bank.account_name_en ?? ""}
              onChangeAr={(v) => onChange({ account_name_ar: v })}
              onChangeEn={(v) => onChange({ account_name_en: v })}
              maxLength={150}
            />
            <BilingualInputs
              label={t("branch")}
              valueAr={bank.branch_ar ?? ""}
              valueEn={bank.branch_en ?? ""}
              onChangeAr={(v) => onChange({ branch_ar: v })}
              onChangeEn={(v) => onChange({ branch_en: v })}
              maxLength={150}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                dir="ltr"
                placeholder={t("accountNumber")}
                value={bank.account_number ?? ""}
                onChange={(e) => onChange({ account_number: e.target.value })}
              />
              <Input
                dir="ltr"
                placeholder={t("iban")}
                value={bank.iban ?? ""}
                onChange={(e) => onChange({ iban: e.target.value })}
              />
              <Input
                dir="ltr"
                placeholder={t("swift")}
                value={bank.swift ?? ""}
                onChange={(e) => onChange({ swift: e.target.value })}
              />
              <Select value={bank.currency} onValueChange={(v) => onChange({ currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs ps-6">
          <Switch checked={bank.is_primary} onCheckedChange={(v) => onChange({ is_primary: v })} />
          <Star className="h-3.5 w-3.5" />
          {t("primary")}
        </div>
      </CardContent>
    </Card>
  );
}

export function AttachmentRow({
  categoryLabel,
  fileName,
  size,
  pending,
  onDownload,
  onDelete,
}: {
  categoryLabel: string;
  fileName: string;
  size?: number;
  pending?: boolean;
  onDownload?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:bg-muted/30 transition-colors">
      <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <FileIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
          <span className="truncate">{categoryLabel}</span>
          {pending && (
            <Badge variant="outline" className="h-4 text-[10px] px-1">
              pending
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {fileName}
          {size ? ` · ${formatBytes(size)}` : ""}
        </div>
      </div>
      {onDownload && (
        <Button type="button" variant="ghost" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4" />
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

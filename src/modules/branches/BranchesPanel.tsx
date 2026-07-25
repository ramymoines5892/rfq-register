import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Landmark, Building2, Plus, Search, MapPin, Users2, Warehouse, Star, Pencil, Trash2,
  Save, Phone, Mail, Globe, X, Loader2, ShieldCheck, ChevronRight,
} from "lucide-react";

import {
  useAllUsersLite,
  useBranchAssignments,
  useBranches,
  useDeleteBranchWithTransfer,
  useSetBranchAssignments,
  useUpsertBranch,
} from "@/modules/branches/queries";
import type { BranchAssignment, BranchWithCounts } from "@/modules/branches/api";
import { getCities, getStates, hasGeo } from "@/lib/geoData";

export function BranchesPanel({ canManage }: { canManage: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: branches = [], isLoading } = useBranches();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<BranchWithCounts | "new" | null>(null);
  const [toDelete, setToDelete] = useState<BranchWithCounts | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) =>
      [b.name, b.name_ar, b.code, b.city, b.country, b.email]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [branches, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={ar ? "بحث بالاسم أو الكود أو المدينة…" : "Search by name, code, city…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        {canManage && (
          <Button onClick={() => setEditing("new")} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            {ar ? "فرع جديد" : "New branch"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-3">
            <Landmark className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <div className="text-sm font-medium">{ar ? "لا توجد فروع بعد" : "No branches yet"}</div>
            <div className="text-xs text-muted-foreground">
              {ar ? "ابدأ بإضافة أول فرع لشركتك — يمكن أن يكون موقعًا جغرافيًا أو وحدة أعمال." : "Add the first branch — a geographic location or a business unit."}
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setEditing("new")} className="gap-1.5">
                <Plus className="h-4 w-4" /> {ar ? "إضافة فرع" : "Add branch"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((b) => (
            <BranchCard key={b.id} branch={b} canManage={canManage} onEdit={() => setEditing(b)} onDelete={() => setToDelete(b)} />
          ))}
        </div>
      )}

      {editing && (
        <BranchEditor
          branch={editing === "new" ? null : editing}
          canManage={canManage}
          onClose={() => setEditing(null)}
        />
      )}

      {toDelete && (
        <DeleteBranchDialog
          branch={toDelete}
          candidates={branches.filter((b) => b.id !== toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function BranchCard({
  branch, canManage, onEdit, onDelete,
}: { branch: BranchWithCounts; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const display = ar ? (branch.name_ar || branch.name) : branch.name;

  return (
    <Card className="group hover:border-primary/60 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold text-sm truncate">{display}</div>
              {branch.is_head_office && (
                <Badge variant="secondary" className="text-[9px] gap-0.5"><Star className="h-2.5 w-2.5" /> {ar ? "مقر رئيسى" : "HQ"}</Badge>
              )}
              {!branch.is_active && <Badge variant="outline" className="text-[9px]">{ar ? "غير نشط" : "Inactive"}</Badge>}
            </div>
            {branch.code && <div className="text-[11px] text-muted-foreground font-mono">{branch.code}</div>}
          </div>
        </div>

        {(branch.city || branch.country) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {[branch.city, branch.state, branch.country].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <StatChip icon={Users2} label={ar ? "موظف" : "Emp"} value={branch.employees_count} />
          <StatChip icon={Warehouse} label={ar ? "مخزن" : "WH"}  value={branch.warehouses_count} />
          <StatChip icon={ShieldCheck} label={ar ? "مستخدم" : "User"} value={branch.users_count} />
        </div>

        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="flex-1 h-8 gap-1.5" onClick={onEdit}>
            <Pencil className="h-3 w-3" /> {ar ? "تعديل" : "Edit"}
          </Button>
          {canManage && !branch.is_head_office && (
            <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: typeof Users2; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function BranchEditor({
  branch, canManage, onClose,
}: { branch: BranchWithCounts | null; canManage: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const isNew = !branch;

  const [form, setForm] = useState({
    name:            branch?.name          ?? "",
    name_ar:         branch?.name_ar       ?? "",
    code:            branch?.code          ?? "",
    is_head_office:  branch?.is_head_office ?? false,
    is_active:       branch?.is_active     ?? true,
    country:         branch?.country       ?? "",
    state:           branch?.state         ?? "",
    city:            branch?.city          ?? "",
    postal_code:     branch?.postal_code   ?? "",
    address_line:    branch?.address_line  ?? "",
    phone:           branch?.phone         ?? "",
    mobile:          branch?.mobile        ?? "",
    fax:             branch?.fax           ?? "",
    email:           branch?.email         ?? "",
    website:         branch?.website       ?? "",
    timezone:        branch?.timezone      ?? "",
    base_currency:   branch?.base_currency ?? "",
    notes:           branch?.notes         ?? "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const upsert = useUpsertBranch();

  async function save() {
    if (!form.name.trim()) { toast.error(ar ? "الاسم مطلوب" : "Name required"); return; }
    try {
      const saved = await upsert.mutateAsync({
        id: branch?.id ?? null,
        payload: {
          ...form,
          name: form.name.trim(),
          code: form.code?.trim() || null,
        },
      });
      toast.success(ar ? "تم الحفظ" : "Saved");
      if (isNew) onClose();
      else Object.assign(branch, saved);
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-2xl overflow-y-auto scrollbar-slim">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {isNew ? (ar ? "إضافة فرع" : "Add branch") : (ar ? "تعديل الفرع" : "Edit branch")}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="general">{ar ? "عام" : "General"}</TabsTrigger>
            <TabsTrigger value="contact">{ar ? "التواصل" : "Contact"}</TabsTrigger>
            <TabsTrigger value="users" disabled={isNew}>{ar ? "المستخدمون" : "Users"}</TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="space-y-3 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={ar ? "الاسم (إنجليزى)" : "Name (English)"}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
              </Field>
              <Field label={ar ? "الاسم (عربى)" : "Name (Arabic)"}>
                <Input value={form.name_ar ?? ""} onChange={(e) => set("name_ar", e.target.value)} dir="rtl" />
              </Field>
              <Field label={ar ? "كود الفرع" : "Branch code"} hint={ar ? "يُستخدم فى الترقيم" : "Used in numbering"}>
                <Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="CAI" className="font-mono uppercase" />
              </Field>
              <Field label={ar ? "العملة" : "Base currency"}>
                <Input value={form.base_currency ?? ""} onChange={(e) => set("base_currency", e.target.value.toUpperCase())} placeholder="EGP" className="font-mono uppercase" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.is_head_office} onCheckedChange={(v) => set("is_head_office", v)} />
                <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {ar ? "مقر رئيسى" : "Head office"}</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
                <span>{ar ? "فرع نشط" : "Active"}</span>
              </label>
            </div>

            <div className="border-t pt-3 mt-2 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">{ar ? "العنوان" : "Address"}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label={ar ? "الدولة" : "Country"}>
                  <Select value={form.country || undefined} onValueChange={(v) => setForm((p) => ({ ...p, country: v, state: "", city: "" }))}>
                    <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EG">{ar ? "مصر" : "Egypt"}</SelectItem>
                      <SelectItem value="SA">{ar ? "السعودية" : "Saudi Arabia"}</SelectItem>
                      <SelectItem value="AE">{ar ? "الإمارات" : "UAE"}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={ar ? "المحافظة" : "State"}>
                  {hasGeo(form.country) ? (
                    <Select value={form.state || undefined} onValueChange={(v) => setForm((p) => ({ ...p, state: v, city: "" }))}>
                      <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                      <SelectContent>
                        {getStates(form.country).map((s) => (
                          <SelectItem key={s.key} value={s.key}>{ar ? s.ar : s.en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
                  )}
                </Field>
                <Field label={ar ? "المدينة" : "City"}>
                  {hasGeo(form.country) && form.state ? (
                    <Select value={form.city || undefined} onValueChange={(v) => set("city", v)}>
                      <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                      <SelectContent>
                        {getCities(form.country, form.state).map((c) => (
                          <SelectItem key={c.en} value={ar ? c.ar : c.en}>{ar ? c.ar : c.en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                  )}
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={ar ? "الرمز البريدى" : "Postal code"}>
                  <Input value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} />
                </Field>
                <Field label={ar ? "المنطقة الزمنية" : "Timezone"}>
                  <Input value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} placeholder="Africa/Cairo" className="font-mono" />
                </Field>
              </div>
              <Field label={ar ? "العنوان التفصيلى" : "Address line"}>
                <Textarea value={form.address_line ?? ""} onChange={(e) => set("address_line", e.target.value)} rows={2} />
              </Field>
            </div>
          </TabsContent>

          {/* Contact */}
          <TabsContent value="contact" className="space-y-3 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={ar ? "تليفون أرضى" : "Landline"} icon={Phone}>
                <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label={ar ? "موبايل" : "Mobile"} icon={Phone}>
                <Input value={form.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
              </Field>
              <Field label="Fax" icon={Phone}>
                <Input value={form.fax ?? ""} onChange={(e) => set("fax", e.target.value)} />
              </Field>
              <Field label={ar ? "بريد إلكترونى" : "Email"} icon={Mail}>
                <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label={ar ? "الموقع الإلكترونى" : "Website"} icon={Globe}>
                <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
              </Field>
            </div>
            <Field label={ar ? "ملاحظات" : "Notes"}>
              <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </Field>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="mt-4">
            {branch && <BranchUsers branchId={branch.id} canManage={canManage} />}
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 mt-6 -mx-6 -mb-6 px-6 py-3 bg-background border-t flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="gap-1.5"><X className="h-4 w-4" /> {ar ? "إغلاق" : "Close"}</Button>
          {canManage && (
            <Button onClick={save} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label, hint, icon: Icon, children,
}: { label: string; hint?: string; icon?: typeof Phone; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />} {label}
        {hint && <span className="text-[10px] text-muted-foreground font-normal">— {hint}</span>}
      </Label>
      {children}
    </div>
  );
}

function BranchUsers({ branchId, canManage }: { branchId: string; canManage: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: users = [], isLoading: usersLoading } = useAllUsersLite();
  const { data: assignments = [], isLoading: aLoading } = useBranchAssignments(branchId);
  const setMut = useSetBranchAssignments();

  const [draft, setDraft] = useState<Record<string, { assigned: boolean; is_default: boolean }>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (usersLoading || aLoading) return;
    const map: Record<string, { assigned: boolean; is_default: boolean }> = {};
    for (const u of users) {
      const a = assignments.find((x) => x.user_id === u.id);
      map[u.id] = { assigned: !!a, is_default: !!a?.is_default };
    }
    setDraft(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersLoading, aLoading, users.length, assignments.length]);

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  function toggle(userId: string, v: boolean) {
    setDraft((p) => ({ ...p, [userId]: { assigned: v, is_default: v ? (p[userId]?.is_default ?? false) : false } }));
  }
  function setDefault(userId: string, v: boolean) {
    setDraft((p) => ({ ...p, [userId]: { assigned: true, is_default: v } }));
  }

  async function save() {
    const rows: BranchAssignment[] = Object.entries(draft)
      .filter(([, v]) => v.assigned)
      .map(([user_id, v]) => ({ user_id, branch_id: branchId, is_default: v.is_default }));
    try {
      await setMut.mutateAsync({ branchId, assignments: rows });
      toast.success(ar ? "تم حفظ الصلاحيات" : "Access saved");
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  if (usersLoading || aLoading) {
    return <div className="text-sm text-muted-foreground py-4 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {ar
          ? "المستخدمون المسموح لهم بالوصول لبيانات هذا الفرع. المستخدم بدون أى تخصيص يرى كل الفروع افتراضيًا."
          : "Users granted access to this branch. Users with no assignment fall back to seeing all branches."}
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ar ? "بحث…" : "Search…"} className="ps-9 h-9" />
      </div>

      <div className="border rounded-lg max-h-[380px] overflow-y-auto scrollbar-slim divide-y">
        {filtered.map((u) => {
          const st = draft[u.id] ?? { assigned: false, is_default: false };
          return (
            <div key={u.id} className="flex items-center gap-3 p-2.5">
              <input
                type="checkbox"
                checked={st.assigned}
                onChange={(e) => toggle(u.id, e.target.checked)}
                disabled={!canManage}
                className="h-4 w-4 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.full_name ?? u.email ?? u.id.slice(0, 8)}</div>
                {u.email && <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>}
              </div>
              <label className={`flex items-center gap-1 text-[11px] ${st.assigned ? "" : "opacity-40"}`}>
                <input
                  type="radio"
                  name={`default-${branchId}`}
                  checked={st.is_default}
                  onChange={(e) => setDefault(u.id, e.target.checked)}
                  disabled={!st.assigned || !canManage}
                  className="accent-primary"
                />
                {ar ? "افتراضى" : "Default"}
              </label>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="p-4 text-xs text-center text-muted-foreground">{ar ? "لا توجد نتائج" : "No results"}</div>}
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={setMut.isPending} className="gap-1.5">
            {setMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {ar ? "حفظ الصلاحيات" : "Save access"}
          </Button>
        </div>
      )}
    </div>
  );
}

function DeleteBranchDialog({
  branch, candidates, onClose,
}: { branch: BranchWithCounts; candidates: BranchWithCounts[]; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [targetId, setTargetId] = useState<string>("");
  const mut = useDeleteBranchWithTransfer();

  const total = branch.employees_count + branch.warehouses_count + branch.users_count;

  async function confirm() {
    if (!targetId) { toast.error(ar ? "اختر فرعًا بديلًا" : "Select a target"); return; }
    try {
      await mut.mutateAsync({ sourceId: branch.id, targetId });
      toast.success(ar ? "تم نقل التبعية وحذف الفرع" : "Dependencies moved and branch deleted");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> {ar ? "حذف الفرع" : "Delete branch"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? `سيتم نقل ${total} عنصر (موظفين/مخازن/مستخدمين) للفرع البديل قبل الحذف.`
              : `${total} dependencies (employees / warehouses / users) will be moved to the target before deletion.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="text-xs text-muted-foreground">{ar ? "الفرع المراد حذفه" : "Branch to delete"}</div>
            <div className="font-medium">{ar ? (branch.name_ar || branch.name) : branch.name}</div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{ar ? "نقل التبعية إلى" : "Transfer dependencies to"}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر فرعًا…" : "Choose a branch…"} /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      {ar ? (c.name_ar || c.name) : c.name}
                      {c.is_head_office && <Badge variant="secondary" className="text-[9px]">HQ</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button variant="destructive" onClick={confirm} disabled={!targetId || mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : <Trash2 className="h-4 w-4 me-1.5" />}
            {ar ? "نقل وحذف" : "Transfer & delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

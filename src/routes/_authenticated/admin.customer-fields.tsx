import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft, Settings2, Plus, Trash2, Pencil, ChevronUp, ChevronDown, GripVertical,
  Lock, Eye, EyeOff, ShieldAlert,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";

type FieldDef = Database["public"]["Tables"]["customer_field_definitions"]["Row"];
type FieldOption = Database["public"]["Tables"]["customer_field_options"]["Row"];
type FieldType = Database["public"]["Enums"]["customer_field_type"];

export const Route = createFileRoute("/_authenticated/admin/customer-fields")({
  component: CustomerFieldsAdmin,
  head: () => ({ meta: [{ title: "إعدادات حقول العميل | Customer Field Settings" }] }),
});

const FIELD_TYPES: { value: FieldType; ar: string; en: string }[] = [
  { value: "text", ar: "نص", en: "Text" },
  { value: "bilingual_text", ar: "نص عربي/إنجليزي", en: "Bilingual Text" },
  { value: "textarea", ar: "نص طويل", en: "Long Text" },
  { value: "number", ar: "رقم", en: "Number" },
  { value: "email", ar: "بريد إلكتروني", en: "Email" },
  { value: "phone", ar: "تليفون", en: "Phone" },
  { value: "date", ar: "تاريخ", en: "Date" },
  { value: "checkbox", ar: "نعم/لا", en: "Checkbox" },
  { value: "dropdown", ar: "قائمة منسدلة", en: "Dropdown" },
  { value: "multiselect", ar: "اختيار متعدد", en: "Multi-select" },
  { value: "file", ar: "رفع ملف", en: "File" },
];

const needsOptions = (t: FieldType) => t === "dropdown" || t === "multiselect";

function CustomerFieldsAdmin() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [optionsByField, setOptionsByField] = useState<Record<string, FieldOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [{ data: defs }, { data: opts }] = await Promise.all([
      supabase.from("customer_field_definitions").select("*").order("position", { ascending: true }),
      supabase.from("customer_field_options").select("*").order("position", { ascending: true }),
    ]);
    setFields(defs ?? []);
    const grouped: Record<string, FieldOption[]> = {};
    for (const o of opts ?? []) {
      (grouped[o.field_id] ??= []).push(o);
    }
    setOptionsByField(grouped);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setCanManage(false); return; }
      const { data } = await supabase.rpc("has_permission", {
        _user_id: userData.user.id,
        _perm: "manage_customer_fields",
      });
      setCanManage(Boolean(data));
      await loadAll();
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const f of fields) {
      const sec = (ar ? f.section_ar : f.section_en) || (ar ? "بدون قسم" : "No section");
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(f);
    }
    return Array.from(map.entries());
  }, [fields, ar]);

  async function move(field: FieldDef, dir: -1 | 1) {
    const sameSection = fields.filter(f => (f.section_ar ?? "") === (field.section_ar ?? "")).sort((a, b) => a.position - b.position);
    const idx = sameSection.findIndex(f => f.id === field.id);
    const target = sameSection[idx + dir];
    if (!target) return;
    await Promise.all([
      supabase.from("customer_field_definitions").update({ position: target.position }).eq("id", field.id),
      supabase.from("customer_field_definitions").update({ position: field.position }).eq("id", target.id),
    ]);
    loadAll();
  }

  async function toggleActive(field: FieldDef) {
    await supabase.from("customer_field_definitions").update({ is_active: !field.is_active }).eq("id", field.id);
    loadAll();
  }

  async function removeField(field: FieldDef) {
    if (field.is_system) { toast.error(ar ? "لا يمكن حذف حقل نظام" : "System fields cannot be deleted"); return; }
    if (!confirm(ar ? `حذف الحقل "${field.label_ar}"؟ (كل القيم المرتبطة هتتحذف)` : `Delete field "${field.label_en}"? All linked values will be removed.`)) return;
    const { error } = await supabase.from("customer_field_definitions").delete().eq("id", field.id);
    if (error) { toast.error(error.message); return; }
    toast.success(ar ? "تم الحذف" : "Deleted");
    loadAll();
  }

  if (canManage === null) return <div className="p-8 text-center text-muted-foreground">{ar ? "جاري التحقق..." : "Checking..."}</div>;
  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 px-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
            <h2 className="text-lg font-bold">{ar ? "غير مصرح" : "Not authorized"}</h2>
            <p className="text-sm text-muted-foreground">
              {ar ? "محتاج صلاحية «إدارة حقول العميل» عشان تفتح الشاشة دي." : "You need the 'manage_customer_fields' permission to open this screen."}
            </p>
            <Link to="/"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{ar ? "رجوع" : "Back"}</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/customers"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{ar ? "رجوع للعملاء" : "Back to Customers"}</Button></Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> {ar ? "إعدادات حقول العميل" : "Customer Field Settings"}
          </h1>
          <Button size="sm" onClick={() => { setEditing(null); setDrawerOpen(true); }}>
            <Plus className="h-4 w-4 me-1" /> {ar ? "حقل جديد" : "New Field"}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{ar ? "تحميل..." : "Loading..."}</div>
        ) : fields.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            {ar ? "لا توجد حقول. أضف أول حقل." : "No fields yet. Add your first."}
          </CardContent></Card>
        ) : (
          grouped.map(([section, list]) => (
            <div key={section} className="space-y-2">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{section}</h2>
              <div className="space-y-2">
                {list.map((f) => (
                  <Card key={f.id} className={f.is_active ? "" : "opacity-60"}>
                    <CardContent className="p-3 flex flex-wrap items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{ar ? f.label_ar : f.label_en}</span>
                          {f.is_required && <span className="text-destructive font-bold">*</span>}
                          {f.is_system && <Badge variant="secondary" className="text-[10px] gap-1"><Lock className="h-3 w-3" />{ar ? "نظام" : "System"}</Badge>}
                          <Badge variant="outline" className="text-[10px]">{FIELD_TYPES.find(t => t.value === f.field_type)?.[ar ? "ar" : "en"]}</Badge>
                          {needsOptions(f.field_type) && (
                            <Badge variant="outline" className="text-[10px]">
                              {(optionsByField[f.id]?.length ?? 0)} {ar ? "خيار" : "options"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">{f.key}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => move(f, -1)} title={ar ? "لأعلى" : "Up"}><ChevronUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => move(f, 1)} title={ar ? "لأسفل" : "Down"}><ChevronDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleActive(f)} title={f.is_active ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}>
                          {f.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(f); setDrawerOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        {!f.is_system && (
                          <Button variant="ghost" size="icon" onClick={() => removeField(f)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      <FieldEditor
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editing={editing}
        existingKeys={fields.map(f => f.key)}
        maxPosition={Math.max(0, ...fields.map(f => f.position))}
        options={editing ? (optionsByField[editing.id] ?? []) : []}
        onSaved={loadAll}
        ar={ar}
      />
    </div>
  );
}

function FieldEditor({
  open, onOpenChange, editing, existingKeys, maxPosition, options, onSaved, ar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FieldDef | null;
  existingKeys: string[];
  maxPosition: number;
  options: FieldOption[];
  onSaved: () => void;
  ar: boolean;
}) {
  const [key, setKey] = useState("");
  const [labelAr, setLabelAr] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sectionAr, setSectionAr] = useState("");
  const [sectionEn, setSectionEn] = useState("");
  const [placeholderAr, setPlaceholderAr] = useState("");
  const [placeholderEn, setPlaceholderEn] = useState("");
  const [validation, setValidation] = useState<{ minLength?: string; maxLength?: string; min?: string; max?: string; pattern?: string }>({});
  const [localOptions, setLocalOptions] = useState<{ id?: string; value: string; label_ar: string; label_en: string; is_active: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKey(editing.key);
      setLabelAr(editing.label_ar);
      setLabelEn(editing.label_en);
      setFieldType(editing.field_type);
      setIsRequired(editing.is_required);
      setIsActive(editing.is_active);
      setSectionAr(editing.section_ar ?? "");
      setSectionEn(editing.section_en ?? "");
      setPlaceholderAr(editing.placeholder_ar ?? "");
      setPlaceholderEn(editing.placeholder_en ?? "");
      const v = (editing.validation_rules as Record<string, unknown>) || {};
      setValidation({
        minLength: v.minLength?.toString() ?? "",
        maxLength: v.maxLength?.toString() ?? "",
        min: v.min?.toString() ?? "",
        max: v.max?.toString() ?? "",
        pattern: (v.pattern as string) ?? "",
      });
      setLocalOptions(options.map(o => ({ id: o.id, value: o.value, label_ar: o.label_ar, label_en: o.label_en, is_active: o.is_active })));
    } else {
      setKey(""); setLabelAr(""); setLabelEn(""); setFieldType("text");
      setIsRequired(false); setIsActive(true);
      setSectionAr(""); setSectionEn("");
      setPlaceholderAr(""); setPlaceholderEn("");
      setValidation({});
      setLocalOptions([]);
    }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  async function save() {
    if (!labelAr.trim() || !labelEn.trim()) { toast.error(ar ? "الاسم بالعربي والإنجليزي مطلوب" : "AR and EN labels required"); return; }
    const finalKey = (key.trim() || slugify(labelEn || labelAr)).slice(0, 60);
    if (!finalKey) { toast.error(ar ? "المفتاح مطلوب" : "Key required"); return; }
    if (!editing && existingKeys.includes(finalKey)) { toast.error(ar ? "المفتاح مستخدم" : "Key already used"); return; }
    if (needsOptions(fieldType) && localOptions.length === 0) {
      toast.error(ar ? "أضف قيمة واحدة على الأقل للقائمة" : "Add at least one option"); return;
    }

    setSaving(true);
    const rules: Record<string, string | number> = {};
    if (validation.minLength) rules.minLength = Number(validation.minLength);
    if (validation.maxLength) rules.maxLength = Number(validation.maxLength);
    if (validation.min) rules.min = Number(validation.min);
    if (validation.max) rules.max = Number(validation.max);
    if (validation.pattern) rules.pattern = validation.pattern;

    const payload = {
      key: finalKey,
      label_ar: labelAr.trim(),
      label_en: labelEn.trim(),
      field_type: fieldType,
      is_required: isRequired,
      is_active: isActive,
      section_ar: sectionAr.trim() || null,
      section_en: sectionEn.trim() || null,
      placeholder_ar: placeholderAr.trim() || null,
      placeholder_en: placeholderEn.trim() || null,
      validation_rules: rules as unknown as import("@/integrations/supabase/types").Json,
    };

    let fieldId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("customer_field_definitions").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("customer_field_definitions")
        .insert({ ...payload, position: maxPosition + 10 })
        .select("id").single();
      if (error || !data) { setSaving(false); toast.error(error?.message ?? "Error"); return; }
      fieldId = data.id;
    }

    if (fieldId && needsOptions(fieldType)) {
      // Replace-all strategy for options
      await supabase.from("customer_field_options").delete().eq("field_id", fieldId);
      const rows = localOptions
        .filter(o => o.value.trim() && o.label_ar.trim() && o.label_en.trim())
        .map((o, i) => ({
          field_id: fieldId!,
          value: o.value.trim(),
          label_ar: o.label_ar.trim(),
          label_en: o.label_en.trim(),
          position: (i + 1) * 10,
          is_active: o.is_active,
        }));
      if (rows.length) {
        const { error } = await supabase.from("customer_field_options").insert(rows);
        if (error) { setSaving(false); toast.error(error.message); return; }
      }
    } else if (fieldId && !needsOptions(fieldType)) {
      // If field type changed away from options, clean them up
      await supabase.from("customer_field_options").delete().eq("field_id", fieldId);
    }

    setSaving(false);
    toast.success(ar ? "تم الحفظ" : "Saved");
    onOpenChange(false);
    onSaved();
  }

  const showText = fieldType === "text" || fieldType === "textarea" || fieldType === "bilingual_text";
  const showNumber = fieldType === "number";
  const isSystem = editing?.is_system ?? false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? (ar ? "تعديل حقل" : "Edit Field") : (ar ? "حقل جديد" : "New Field")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {isSystem && (
            <div className="bg-muted p-2 rounded text-xs text-muted-foreground flex items-center gap-2">
              <Lock className="h-3 w-3" />
              {ar ? "دا حقل نظام. المفتاح ونوع الحقل ثابتين." : "System field. Key and type are locked."}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{ar ? "الاسم بالعربي" : "Label (AR)"} *</Label>
              <Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} />
            </div>
            <div>
              <Label>{ar ? "الاسم بالإنجليزي" : "Label (EN)"} *</Label>
              <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{ar ? "المفتاح (تقني)" : "Key (technical)"}</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={ar ? "هيتولد تلقائيًا من الاسم" : "Auto-generated from label"} disabled={isSystem} className="font-mono text-sm" />
          </div>

          <div>
            <Label>{ar ? "نوع الحقل" : "Field Type"}</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)} disabled={isSystem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{ar ? t.ar : t.en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <div>
              <Label className="cursor-pointer">{ar ? "مطلوب" : "Required"} *</Label>
              <div className="text-xs text-muted-foreground">{ar ? "الحقل لازم يتملى" : "Field must be filled"}</div>
            </div>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <div>
              <Label className="cursor-pointer">{ar ? "مفعل" : "Active"}</Label>
              <div className="text-xs text-muted-foreground">{ar ? "يظهر في شاشة العميل" : "Shown on customer form"}</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{ar ? "القسم (عربي)" : "Section (AR)"}</Label>
              <Input value={sectionAr} onChange={(e) => setSectionAr(e.target.value)} placeholder={ar ? "بيانات أساسية" : "بيانات أساسية"} />
            </div>
            <div>
              <Label>{ar ? "القسم (إنجليزي)" : "Section (EN)"}</Label>
              <Input value={sectionEn} onChange={(e) => setSectionEn(e.target.value)} placeholder="Basic Info" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{ar ? "Placeholder عربي" : "Placeholder (AR)"}</Label>
              <Input value={placeholderAr} onChange={(e) => setPlaceholderAr(e.target.value)} />
            </div>
            <div>
              <Label>{ar ? "Placeholder إنجليزي" : "Placeholder (EN)"}</Label>
              <Input value={placeholderEn} onChange={(e) => setPlaceholderEn(e.target.value)} />
            </div>
          </div>

          {showText && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{ar ? "أقل عدد أحرف" : "Min length"}</Label>
                <Input type="number" value={validation.minLength ?? ""} onChange={(e) => setValidation(v => ({ ...v, minLength: e.target.value }))} />
              </div>
              <div>
                <Label>{ar ? "أقصى عدد أحرف" : "Max length"}</Label>
                <Input type="number" value={validation.maxLength ?? ""} onChange={(e) => setValidation(v => ({ ...v, maxLength: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>{ar ? "Regex Pattern (اختياري)" : "Regex pattern (optional)"}</Label>
                <Input value={validation.pattern ?? ""} onChange={(e) => setValidation(v => ({ ...v, pattern: e.target.value }))} placeholder="^[0-9]{14}$" className="font-mono text-sm" />
              </div>
            </div>
          )}

          {showNumber && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{ar ? "أقل قيمة" : "Min value"}</Label>
                <Input type="number" value={validation.min ?? ""} onChange={(e) => setValidation(v => ({ ...v, min: e.target.value }))} />
              </div>
              <div>
                <Label>{ar ? "أقصى قيمة" : "Max value"}</Label>
                <Input type="number" value={validation.max ?? ""} onChange={(e) => setValidation(v => ({ ...v, max: e.target.value }))} />
              </div>
            </div>
          )}

          {needsOptions(fieldType) && (
            <div className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold">{ar ? "قيم القائمة" : "List Options"}</Label>
                <Button size="sm" variant="outline" onClick={() => setLocalOptions(o => [...o, { value: "", label_ar: "", label_en: "", is_active: true }])}>
                  <Plus className="h-3 w-3 me-1" /> {ar ? "قيمة" : "Option"}
                </Button>
              </div>
              {localOptions.length === 0 && <p className="text-xs text-muted-foreground">{ar ? "لا توجد قيم بعد." : "No options yet."}</p>}
              {localOptions.map((opt, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center">
                  <Input placeholder={ar ? "القيمة" : "value"} value={opt.value} onChange={(e) => setLocalOptions(list => list.map((o, j) => j === i ? { ...o, value: e.target.value } : o))} className="text-xs font-mono h-8" />
                  <Input placeholder="AR" value={opt.label_ar} onChange={(e) => setLocalOptions(list => list.map((o, j) => j === i ? { ...o, label_ar: e.target.value } : o))} className="text-xs h-8" />
                  <Input placeholder="EN" value={opt.label_en} onChange={(e) => setLocalOptions(list => list.map((o, j) => j === i ? { ...o, label_en: e.target.value } : o))} className="text-xs h-8" />
                  <Button size="icon" variant="ghost" onClick={() => setLocalOptions(list => list.filter((_, j) => j !== i))} className="h-8 w-8 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={save} disabled={saving}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

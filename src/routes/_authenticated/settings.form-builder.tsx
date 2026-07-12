import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Pencil, GripVertical, Lock, Eye, EyeOff, ShieldAlert,
  LayoutGrid, Save, Info,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Database } from "@/integrations/supabase/types";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, rectSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type FieldDef = Database["public"]["Tables"]["customer_field_definitions"]["Row"];
type FieldOption = Database["public"]["Tables"]["customer_field_options"]["Row"];
type FieldType = Database["public"]["Enums"]["customer_field_type"];

export const Route = createFileRoute("/_authenticated/settings/form-builder")({
  component: FormBuilderPage,
  head: () => ({ meta: [{ title: "منشئ الحقول | Form Builder" }] }),
});

const FIELD_TYPES: { value: FieldType; ar: string; en: string }[] = [
  { value: "text", ar: "نص", en: "Text" },
  { value: "bilingual_text", ar: "نص عربي/إنجليزي", en: "Bilingual Text" },
  { value: "textarea", ar: "نص طويل", en: "Long Text" },
  { value: "number", ar: "رقم", en: "Number" },
  { value: "email", ar: "بريد", en: "Email" },
  { value: "phone", ar: "تليفون", en: "Phone" },
  { value: "date", ar: "تاريخ", en: "Date" },
  { value: "checkbox", ar: "نعم/لا", en: "Checkbox" },
  { value: "dropdown", ar: "قائمة", en: "Dropdown" },
  { value: "multiselect", ar: "اختيار متعدد", en: "Multi-select" },
  { value: "file", ar: "ملف", en: "File" },
];

const COL_OPTIONS = [3, 4, 6, 8, 12] as const;
const needsOptions = (t: FieldType) => t === "dropdown" || t === "multiselect";

const ENTITIES = [
  { key: "customers", ar: "شاشة العميل", en: "Customer" },
] as const;

function FormBuilderPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [entity, setEntity] = useState<string>("customers");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [optionsByField, setOptionsByField] = useState<Record<string, FieldOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [{ data: defs }, { data: opts }] = await Promise.all([
      supabase
        .from("customer_field_definitions")
        .select("*")
        .eq("entity_key", entity)
        .order("position", { ascending: true }),
      supabase.from("customer_field_options").select("*").order("position", { ascending: true }),
    ]);
    setFields(defs ?? []);
    const grouped: Record<string, FieldOption[]> = {};
    for (const o of opts ?? []) (grouped[o.field_id] ??= []).push(o);
    setOptionsByField(grouped);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setCanManage(false); return; }
      // Accept either the legacy or the new unified permission
      const [{ data: legacy }, { data: unified }] = await Promise.all([
        supabase.rpc("has_permission", { _user_id: userData.user.id, _perm: "manage_customer_fields" }),
        supabase.rpc("has_permission", { _user_id: userData.user.id, _perm: "manage_form_fields" }),
      ]);
      setCanManage(Boolean(legacy) || Boolean(unified));
    })();
  }, []);

  useEffect(() => { if (canManage) loadAll(); }, [canManage, entity]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const f of fields) {
      const sec = (ar ? f.section_ar : f.section_en) || (ar ? "بدون قسم" : "No section");
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(f);
    }
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.position - b.position),
    }));
  }, [fields, ar]);

  async function updateColSpan(f: FieldDef, span: number) {
    setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, col_span: span } : x)));
    const { error } = await supabase.from("customer_field_definitions").update({ col_span: span }).eq("id", f.id);
    if (error) toast.error(error.message);
  }

  async function toggleActive(f: FieldDef) {
    setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from("customer_field_definitions").update({ is_active: !f.is_active }).eq("id", f.id);
  }

  async function removeField(f: FieldDef) {
    if (f.is_system) { toast.error(ar ? "لا يمكن حذف حقل نظام" : "System fields cannot be deleted"); return; }
    if (!confirm(ar ? `حذف الحقل "${f.label_ar}"؟` : `Delete field "${f.label_en}"?`)) return;
    const { error } = await supabase.from("customer_field_definitions").delete().eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success(ar ? "تم الحذف" : "Deleted");
    loadAll();
  }

  async function persistSectionOrder(sectionFields: FieldDef[]) {
    setSavingLayout(true);
    // Reassign positions in tens so future inserts have room
    const updates = sectionFields.map((f, i) => ({ id: f.id, position: (i + 1) * 10 }));
    // Update in parallel
    await Promise.all(updates.map((u) =>
      supabase.from("customer_field_definitions").update({ position: u.position }).eq("id", u.id),
    ));
    setSavingLayout(false);
  }

  function handleDragEnd(sectionName: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const secFields = sections.find((s) => s.name === sectionName)?.items ?? [];
    const oldIdx = secFields.findIndex((f) => f.id === active.id);
    const newIdx = secFields.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(secFields, oldIdx, newIdx);
    // Optimistic update local state
    setFields((prev) => {
      const others = prev.filter((f) => !secFields.includes(f));
      return [...others, ...reordered.map((f, i) => ({ ...f, position: (i + 1) * 10 }))];
    });
    persistSectionOrder(reordered);
  }

  if (canManage === null) {
    return <div className="p-8 text-center text-muted-foreground">{ar ? "جاري التحقق..." : "Checking..."}</div>;
  }
  if (!canManage) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="p-6 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
          <h2 className="text-lg font-bold">{ar ? "غير مصرح" : "Not authorized"}</h2>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "محتاج صلاحية «إدارة حقول النظام» علشان تفتح الصفحة دي."
              : "You need the 'manage_form_fields' permission to open this page."}
          </p>
          <Link to="/settings"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{ar ? "رجوع" : "Back"}</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <LayoutGrid className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{ar ? "منشئ الحقول" : "Form Builder"}</h2>
        {savingLayout && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Save className="h-3 w-3 animate-pulse" /> {ar ? "حفظ..." : "Saving..."}
          </span>
        )}
        <div className="ms-auto flex items-center gap-2">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENTITIES.map((e) => (
                <SelectItem key={e.key} value={e.key}>{ar ? e.ar : e.en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditing(null); setDrawerOpen(true); }}>
            <Plus className="h-4 w-4 me-1" /> {ar ? "حقل جديد" : "New Field"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-dashed p-3 flex gap-2 items-start text-xs text-muted-foreground bg-muted/30">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          {ar
            ? "اسحب الحقل من المقبض علشان تغيّر ترتيبه. غيّر العرض من 3 إلى 12 عمود، والحقول اللي مجموع عرضها 12 هتظهر جنب بعض في نفس السطر."
            : "Drag the handle to reorder. Set each field's width from 3 to 12 columns — fields whose widths sum to 12 sit side-by-side on one row."}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{ar ? "تحميل..." : "Loading..."}</div>
      ) : fields.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {ar ? "لا توجد حقول بعد. أضف أول حقل." : "No fields yet. Add your first."}
        </CardContent></Card>
      ) : (
        sections.map((sec) => (
          <SectionGrid
            key={sec.name}
            title={sec.name}
            items={sec.items}
            optionsByField={optionsByField}
            ar={ar}
            onDragEnd={(e) => handleDragEnd(sec.name, e)}
            onEdit={(f) => { setEditing(f); setDrawerOpen(true); }}
            onColSpan={updateColSpan}
            onToggleActive={toggleActive}
            onDelete={removeField}
          />
        ))
      )}

      <FieldEditor
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editing={editing}
        entityKey={entity}
        existingKeys={fields.map((f) => f.key)}
        maxPosition={Math.max(0, ...fields.map((f) => f.position))}
        options={editing ? optionsByField[editing.id] ?? [] : []}
        onSaved={loadAll}
        ar={ar}
      />
    </div>
  );
}

function SectionGrid({
  title, items, optionsByField, ar, onDragEnd, onEdit, onColSpan, onToggleActive, onDelete,
}: {
  title: string;
  items: FieldDef[];
  optionsByField: Record<string, FieldOption[]>;
  ar: boolean;
  onDragEnd: (e: DragEndEvent) => void;
  onEdit: (f: FieldDef) => void;
  onColSpan: (f: FieldDef, span: number) => void;
  onToggleActive: (f: FieldDef) => void;
  onDelete: (f: FieldDef) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{title}</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((f) => f.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-2 rounded-lg border bg-background/60 p-2">
            {items.map((f) => (
              <SortableFieldCard
                key={f.id}
                field={f}
                optionCount={optionsByField[f.id]?.length ?? 0}
                ar={ar}
                onEdit={() => onEdit(f)}
                onColSpan={(s) => onColSpan(f, s)}
                onToggleActive={() => onToggleActive(f)}
                onDelete={() => onDelete(f)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableFieldCard({
  field, optionCount, ar, onEdit, onColSpan, onToggleActive, onDelete,
}: {
  field: FieldDef;
  optionCount: number;
  ar: boolean;
  onEdit: () => void;
  onColSpan: (s: number) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const span = Math.max(1, Math.min(12, field.col_span || 12));
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${span} / span ${span}`,
    opacity: isDragging ? 0.5 : 1,
  };
  const typeLabel = FIELD_TYPES.find((t) => t.value === field.field_type)?.[ar ? "ar" : "en"] ?? field.field_type;

  return (
    <div ref={setNodeRef} style={style} className={`rounded-md border bg-card p-2 ${field.is_active ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label={ar ? "اسحب" : "Drag"}
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-medium text-sm truncate">{ar ? field.label_ar : field.label_en}</span>
            {field.is_required && <span className="text-destructive font-bold text-sm">*</span>}
            {field.is_system && (
              <Badge variant="secondary" className="text-[9px] gap-0.5 px-1 py-0"><Lock className="h-2.5 w-2.5" />{ar ? "نظام" : "Sys"}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-[9px] px-1 py-0">{typeLabel}</Badge>
            {needsOptions(field.field_type) && (
              <Badge variant="outline" className="text-[9px] px-1 py-0">{optionCount} {ar ? "خيار" : "opts"}</Badge>
            )}
            <span className="text-[9px] text-muted-foreground font-mono truncate">{field.key}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t">
        <div className="flex items-center gap-0.5">
          {COL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => onColSpan(n)}
              type="button"
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                span === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
              title={ar ? `${n}/12` : `${n}/12`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleActive} title={field.is_active ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}>
            {field.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} title={ar ? "تعديل" : "Edit"}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!field.is_system && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete} title={ar ? "حذف" : "Delete"}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Field Editor Drawer (same as before, entity-aware) ----------

function FieldEditor({
  open, onOpenChange, editing, entityKey, existingKeys, maxPosition, options, onSaved, ar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: FieldDef | null;
  entityKey: string;
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
  const [colSpan, setColSpan] = useState<number>(12);
  const [validation, setValidation] = useState<{ minLength?: string; maxLength?: string; min?: string; max?: string; pattern?: string }>({});
  const [localOptions, setLocalOptions] = useState<{ id?: string; value: string; label_ar: string; label_en: string; is_active: boolean }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKey(editing.key); setLabelAr(editing.label_ar); setLabelEn(editing.label_en);
      setFieldType(editing.field_type); setIsRequired(editing.is_required); setIsActive(editing.is_active);
      setSectionAr(editing.section_ar ?? ""); setSectionEn(editing.section_en ?? "");
      setPlaceholderAr(editing.placeholder_ar ?? ""); setPlaceholderEn(editing.placeholder_en ?? "");
      setColSpan(editing.col_span ?? 12);
      const v = (editing.validation_rules as Record<string, unknown>) || {};
      setValidation({
        minLength: v.minLength?.toString() ?? "", maxLength: v.maxLength?.toString() ?? "",
        min: v.min?.toString() ?? "", max: v.max?.toString() ?? "",
        pattern: (v.pattern as string) ?? "",
      });
      setLocalOptions(options.map((o) => ({ id: o.id, value: o.value, label_ar: o.label_ar, label_en: o.label_en, is_active: o.is_active })));
    } else {
      setKey(""); setLabelAr(""); setLabelEn(""); setFieldType("text");
      setIsRequired(false); setIsActive(true); setSectionAr(""); setSectionEn("");
      setPlaceholderAr(""); setPlaceholderEn(""); setColSpan(12);
      setValidation({}); setLocalOptions([]);
    }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  async function save() {
    if (!labelAr.trim() || !labelEn.trim()) { toast.error(ar ? "الاسم بالعربي والإنجليزي مطلوب" : "AR and EN labels required"); return; }
    const finalKey = (key.trim() || slugify(labelEn || labelAr)).slice(0, 60);
    if (!finalKey) { toast.error(ar ? "المفتاح مطلوب" : "Key required"); return; }
    if (!editing && existingKeys.includes(finalKey)) { toast.error(ar ? "المفتاح مستخدم" : "Key already used"); return; }
    if (needsOptions(fieldType) && localOptions.length === 0) { toast.error(ar ? "أضف قيمة واحدة على الأقل" : "Add at least one option"); return; }

    setSaving(true);
    const rules: Record<string, string | number> = {};
    if (validation.minLength) rules.minLength = Number(validation.minLength);
    if (validation.maxLength) rules.maxLength = Number(validation.maxLength);
    if (validation.min) rules.min = Number(validation.min);
    if (validation.max) rules.max = Number(validation.max);
    if (validation.pattern) rules.pattern = validation.pattern;

    const payload = {
      key: finalKey, label_ar: labelAr.trim(), label_en: labelEn.trim(),
      field_type: fieldType, is_required: isRequired, is_active: isActive,
      section_ar: sectionAr.trim() || null, section_en: sectionEn.trim() || null,
      placeholder_ar: placeholderAr.trim() || null, placeholder_en: placeholderEn.trim() || null,
      col_span: colSpan, entity_key: entityKey,
      validation_rules: rules as unknown as import("@/integrations/supabase/types").Json,
    };

    let fieldId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("customer_field_definitions").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("customer_field_definitions")
        .insert({ ...payload, position: maxPosition + 10 }).select("id").single();
      if (error || !data) { setSaving(false); toast.error(error?.message ?? "Error"); return; }
      fieldId = data.id;
    }

    if (fieldId && needsOptions(fieldType)) {
      await supabase.from("customer_field_options").delete().eq("field_id", fieldId);
      const rows = localOptions
        .filter((o) => o.value.trim() && o.label_ar.trim() && o.label_en.trim())
        .map((o, i) => ({
          field_id: fieldId!, value: o.value.trim(),
          label_ar: o.label_ar.trim(), label_en: o.label_en.trim(),
          position: (i + 1) * 10, is_active: o.is_active,
        }));
      if (rows.length) {
        const { error } = await supabase.from("customer_field_options").insert(rows);
        if (error) { setSaving(false); toast.error(error.message); return; }
      }
    } else if (fieldId && !needsOptions(fieldType)) {
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
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={ar ? "هيتولد تلقائيًا" : "Auto-generated"} disabled={isSystem} className="font-mono text-sm" />
          </div>

          <div>
            <Label>{ar ? "نوع الحقل" : "Field Type"}</Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)} disabled={isSystem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{ar ? t.ar : t.en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{ar ? "العرض (بالأعمدة من 12)" : "Width (columns of 12)"}</Label>
            <div className="flex gap-1 mt-1">
              {COL_OPTIONS.map((n) => (
                <button
                  key={n} type="button"
                  onClick={() => setColSpan(n)}
                  className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                    colSpan === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >{n}/12</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <div>
              <Label className="cursor-pointer">{ar ? "مطلوب" : "Required"} *</Label>
              <div className="text-xs text-muted-foreground">{ar ? "لازم يتملى" : "Must be filled"}</div>
            </div>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <div>
              <Label className="cursor-pointer">{ar ? "مفعل" : "Active"}</Label>
              <div className="text-xs text-muted-foreground">{ar ? "يظهر في الشاشة" : "Shown on form"}</div>
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
                <Input type="number" value={validation.minLength ?? ""} onChange={(e) => setValidation((v) => ({ ...v, minLength: e.target.value }))} />
              </div>
              <div>
                <Label>{ar ? "أقصى عدد أحرف" : "Max length"}</Label>
                <Input type="number" value={validation.maxLength ?? ""} onChange={(e) => setValidation((v) => ({ ...v, maxLength: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>{ar ? "Regex Pattern (اختياري)" : "Regex pattern (optional)"}</Label>
                <Input value={validation.pattern ?? ""} onChange={(e) => setValidation((v) => ({ ...v, pattern: e.target.value }))} placeholder="^[0-9]{14}$" className="font-mono text-sm" />
              </div>
            </div>
          )}

          {showNumber && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{ar ? "أقل قيمة" : "Min value"}</Label>
                <Input type="number" value={validation.min ?? ""} onChange={(e) => setValidation((v) => ({ ...v, min: e.target.value }))} />
              </div>
              <div>
                <Label>{ar ? "أقصى قيمة" : "Max value"}</Label>
                <Input type="number" value={validation.max ?? ""} onChange={(e) => setValidation((v) => ({ ...v, max: e.target.value }))} />
              </div>
            </div>
          )}

          {needsOptions(fieldType) && (
            <div className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold">{ar ? "قيم القائمة" : "List Options"}</Label>
                <Button size="sm" variant="outline" onClick={() => setLocalOptions((o) => [...o, { value: "", label_ar: "", label_en: "", is_active: true }])}>
                  <Plus className="h-3 w-3 me-1" /> {ar ? "قيمة" : "Option"}
                </Button>
              </div>
              {localOptions.length === 0 && <p className="text-xs text-muted-foreground">{ar ? "لا توجد قيم بعد." : "No options yet."}</p>}
              {localOptions.map((opt, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center">
                  <Input placeholder={ar ? "القيمة" : "value"} value={opt.value} onChange={(e) => setLocalOptions((list) => list.map((o, j) => j === i ? { ...o, value: e.target.value } : o))} className="text-xs font-mono h-8" />
                  <Input placeholder="AR" value={opt.label_ar} onChange={(e) => setLocalOptions((list) => list.map((o, j) => j === i ? { ...o, label_ar: e.target.value } : o))} className="text-xs h-8" />
                  <Input placeholder="EN" value={opt.label_en} onChange={(e) => setLocalOptions((list) => list.map((o, j) => j === i ? { ...o, label_en: e.target.value } : o))} className="text-xs h-8" />
                  <Button size="icon" variant="ghost" onClick={() => setLocalOptions((list) => list.filter((_, j) => j !== i))} className="h-8 w-8 text-destructive"><Trash2 className="h-3 w-3" /></Button>
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

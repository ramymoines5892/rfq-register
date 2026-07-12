import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCanManageFormFields,
  useFormBuilderData,
  usePersistFieldChanges,
  useSaveFieldDefinition,
  useSoftDeleteField,
  useSoftDeleteFieldsBulk,
} from "@/features/formBuilder/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Pencil, GripVertical, Lock, Eye, EyeOff, ShieldAlert,
  LayoutGrid, Save, Info, Check, X, Undo2, Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import type { Database } from "@/integrations/supabase/types";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, type CollisionDetection, closestCenter, pointerWithin, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, rectSortingStrategy, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type FieldDef = Database["public"]["Tables"]["customer_field_definitions"]["Row"];
type FieldOption = Database["public"]["Tables"]["customer_field_options"]["Row"];
type FieldType = Database["public"]["Enums"]["customer_field_type"];

export const Route = createFileRoute("/_authenticated/settings/form-builder")({
  component: FormBuilderPage,
  head: () => ({ meta: [{ title: "منشئ الحقول | Form Builder" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    entity: typeof s.entity === "string" ? s.entity : undefined,
  }),
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

// System fields that reference another table — displayed as a locked DB-linked dropdown.
const REFERENCE_FIELDS: Record<string, { ar: string; en: string }> = {
  parent_id: { ar: "الإدارة الأب (من قاعدة البيانات)", en: "Parent Department (from database)" },
  department_id: { ar: "الإدارة (من قاعدة البيانات)", en: "Department (from database)" },
  manager_id: { ar: "المدير (من قاعدة البيانات)", en: "Manager (from database)" },
};
const isReferenceField = (f: { key: string; is_system: boolean | null } | null | undefined) =>
  !!f && !!f.is_system && f.key in REFERENCE_FIELDS;

const ENTITIES = [
  { key: "customers", ar: "شاشة العميل", en: "Customer" },
  { key: "department", ar: "شاشة الإدارات", en: "Departments" },
  { key: "job_title", ar: "شاشة المسميات الوظيفية", en: "Job Titles" },
] as const;

function FormBuilderPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const search = useSearch({ from: "/_authenticated/settings/form-builder" });
  const [entity, setEntity] = useState<string>(
    search.entity && ENTITIES.some((e) => e.key === search.entity) ? search.entity : "customers"
  );
  const canManageQ = useCanManageFormFields();
  const canManage = canManageQ.isFetched ? !!canManageQ.data : null;
  const [fields, setFields] = useState<FieldDef[]>([]);
  const originalFieldsRef = useRef<FieldDef[]>([]);
  const [dirty, setDirty] = useState(false);
  const [optionsByField, setOptionsByField] = useState<Record<string, FieldOption[]>>({});
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const dataQ = useFormBuilderData(entity, !!canManage);
  const loading = !canManageQ.isFetched || (!!canManage && dataQ.isLoading);
  const softDeleteM = useSoftDeleteField(entity);
  const softDeleteBulkM = useSoftDeleteFieldsBulk(entity);
  const persistM = usePersistFieldChanges(entity);
  const saveFieldM = useSaveFieldDefinition(entity);
  const saving = persistM.isPending || saveFieldM.isPending;

  // Hydrate local state from query. `dirty` guards against clobbering in-flight edits.
  useEffect(() => {
    if (!dataQ.data) return;
    if (dirty) return;
    setFields(dataQ.data.fields);
    originalFieldsRef.current = dataQ.data.fields.map((f) => ({ ...f }));
    setOptionsByField(dataQ.data.optionsByField);
  }, [dataQ.data, dirty]);

  async function loadAll() {
    setDirty(false);
    await dataQ.refetch();
  }

  // Warn on unload if dirty
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);


  // User-added empty sections (client-only until a field is dropped into them).
  const [extraSections, setExtraSections] = useState<{ sectionAr: string; sectionEn: string }[]>([]);

  const sections = useMemo(() => {
    const map = new Map<string, { sectionAr: string; sectionEn: string; items: FieldDef[] }>();
    for (const f of fields) {
      const sAr = f.section_ar ?? "";
      const sEn = f.section_en ?? "";
      const displayKey = (ar ? sAr : sEn) || sAr || sEn || "";
      const existing = map.get(displayKey);
      if (existing) {
        if (!existing.sectionAr && sAr) existing.sectionAr = sAr;
        if (!existing.sectionEn && sEn) existing.sectionEn = sEn;
        existing.items.push(f);
      } else {
        map.set(displayKey, { sectionAr: sAr, sectionEn: sEn, items: [f] });
      }
    }
    // Merge in user-added empty sections that aren't already represented.
    for (const es of extraSections) {
      const displayKey = (ar ? es.sectionAr : es.sectionEn) || es.sectionAr || es.sectionEn || "";
      if (!map.has(displayKey)) {
        map.set(displayKey, { sectionAr: es.sectionAr, sectionEn: es.sectionEn, items: [] });
      }
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      key,
      sectionAr: v.sectionAr,
      sectionEn: v.sectionEn,
      label: (ar ? v.sectionAr : v.sectionEn) || v.sectionAr || v.sectionEn || (ar ? "بدون قسم" : "No section"),
      items: v.items.sort((a, b) => a.position - b.position),
    }));
  }, [fields, ar, extraSections]);

  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSectionAr, setNewSectionAr] = useState("");
  const [newSectionEn, setNewSectionEn] = useState("");

  function submitNewSection() {
    const nAr = newSectionAr.trim();
    const nEn = newSectionEn.trim();
    if (!nAr && !nEn) {
      toast.error(ar ? "اكتب اسم واحد على الأقل" : "Enter at least one name");
      return;
    }
    const displayKey = (ar ? nAr : nEn) || nAr || nEn;
    if (sections.some((s) => s.key === displayKey)) {
      toast.error(ar ? "فيه قسم بنفس الاسم" : "A section with this name already exists");
      return;
    }
    setExtraSections((prev) => [...prev, { sectionAr: nAr, sectionEn: nEn }]);
    setNewSectionAr("");
    setNewSectionEn("");
    setNewSectionOpen(false);
  }




  function updateColSpan(f: FieldDef, span: number) {
    setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, col_span: span } : x)));
    setDirty(true);
  }

  function toggleActive(f: FieldDef) {
    setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, is_active: !x.is_active } : x)));
    setDirty(true);
  }

  async function removeField(f: FieldDef) {
    if (f.is_system) { toast.error(ar ? "لا يمكن حذف حقل نظام" : "System fields cannot be deleted"); return; }
    const ok = await confirm({
      title: ar ? "حذف الحقل" : "Delete field",
      description: ar
        ? `حذف الحقل "${f.label_ar}"؟\nالـ Owner بس هيقدر يشوفه أو يرجّعه من سلة المحذوفات.`
        : `Delete field "${f.label_en}"?\nOnly the Owner can see or restore it from Trash.`,
      confirmText: ar ? "حذف" : "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_field_definitions").update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
      is_active: false,
    }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success(ar ? "تم النقل لسلة المحذوفات" : "Moved to trash");
    loadAll();
  }

  function renameSection(oldAr: string, oldEn: string, newAr: string, newEn: string) {
    const nAr = newAr.trim() || null;
    const nEn = newEn.trim() || null;
    setFields((prev) =>
      prev.map((f) =>
        (f.section_ar ?? "") === oldAr && (f.section_en ?? "") === oldEn
          ? { ...f, section_ar: nAr, section_en: nEn }
          : f,
      ),
    );
    setDirty(true);
  }

  function reorderSections(activeKey: string, overKey: string) {
    if (activeKey === overKey) return;
    const orderedKeys = sections.map((s) => s.key);
    const from = orderedKeys.indexOf(activeKey);
    const to = orderedKeys.indexOf(overKey);
    if (from < 0 || to < 0) return;
    const newOrder = arrayMove(orderedKeys, from, to);
    // Rebuild extraSections order + renumber every field's position so
    // sections persist in the new order after save/reload.
    const byKey = new Map(sections.map((s) => [s.key, s]));
    let pos = 0;
    const updatedById = new Map<string, FieldDef>();
    for (const k of newOrder) {
      const sec = byKey.get(k);
      if (!sec) continue;
      for (const f of sec.items) {
        pos += 10;
        updatedById.set(f.id, { ...f, position: pos });
      }
    }
    setFields((prev) => prev.map((f) => updatedById.get(f.id) ?? f));
    setExtraSections((prev) => {
      const secByKey = new Map(sections.map((s) => [s.key, s]));
      return newOrder
        .filter((k) => (secByKey.get(k)?.items.length ?? 0) === 0)
        .map((k) => ({ sectionAr: secByKey.get(k)!.sectionAr, sectionEn: secByKey.get(k)!.sectionEn }));
    });
    setDirty(true);
  }

  async function deleteSection(secKey: string) {
    const sec = sections.find((s) => s.key === secKey);
    if (!sec) return;
    if (sec.items.some((f) => f.is_system)) {
      toast.error(ar ? "القسم يحتوي على حقول نظام لا يمكن حذفها" : "Section contains system fields that cannot be deleted");
      return;
    }
    const label = sec.label;
    const ok = await confirm({
      title: ar ? "حذف القسم" : "Delete section",
      description: sec.items.length === 0
        ? (ar ? `حذف القسم "${label}"؟` : `Delete section "${label}"?`)
        : (ar
            ? `حذف القسم "${label}" مع ${sec.items.length} حقل جواه؟\nالحقول هتروح سلة المحذوفات.`
            : `Delete section "${label}" and its ${sec.items.length} field(s)?\nFields will go to Trash.`),
      confirmText: ar ? "حذف" : "Delete",
      variant: "destructive",
    });
    if (!ok) return;

    if (sec.items.length > 0) {
      const { data: u } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const uid = u.user?.id ?? null;
      const results = await Promise.all(
        sec.items.map((f) =>
          supabase.from("customer_field_definitions").update({
            deleted_at: now, deleted_by: uid, is_active: false,
          }).eq("id", f.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) { toast.error(failed.error.message); return; }
    }
    setExtraSections((prev) =>
      prev.filter((es) => ((ar ? es.sectionAr : es.sectionEn) || es.sectionAr || es.sectionEn || "") !== secKey),
    );
    toast.success(ar ? "تم حذف القسم" : "Section deleted");
    if (sec.items.length > 0) loadAll();
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Section-level reorder
    if (activeId.startsWith("SEC::") && overId.startsWith("SEC::")) {
      reorderSections(activeId.slice(5), overId.slice(5));
      return;
    }
    // Ignore mixed section/field drags (e.g. dragging a field over a section header handle)
    if (activeId.startsWith("SEC::") || overId.startsWith("SEC::")) return;

    const activeField = fields.find((f) => f.id === activeId);
    if (!activeField) return;

    let destAr: string | null;
    let destEn: string | null;
    let overField: FieldDef | undefined;

    if (overId.startsWith("__sec:")) {
      const sec = sections.find((s) => `__sec:${s.key}` === overId);
      if (!sec) return;
      destAr = sec.sectionAr || null;
      destEn = sec.sectionEn || null;
    } else {
      overField = fields.find((f) => f.id === overId);
      if (!overField) return;
      const destSec = sections.find((s) => s.items.some((it) => it.id === overField!.id));
      destAr = (destSec?.sectionAr || overField.section_ar) || null;
      destEn = (destSec?.sectionEn || overField.section_en) || null;
    }

    const srcSec = sections.find((s) => s.items.some((it) => it.id === activeField.id));
    const sameSection =
      (srcSec?.sectionAr ?? activeField.section_ar ?? "") === (destAr ?? "") &&
      (srcSec?.sectionEn ?? activeField.section_en ?? "") === (destEn ?? "");

    if (sameSection && overField) {
      const secItems = fields
        .filter((f) => (f.section_ar ?? "") === (destAr ?? "") && (f.section_en ?? "") === (destEn ?? ""))
        .sort((a, b) => a.position - b.position);
      const oldIdx = secItems.findIndex((f) => f.id === activeId);
      const newIdx = secItems.findIndex((f) => f.id === overId);
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(secItems, oldIdx, newIdx).map((f, i) => ({ ...f, position: (i + 1) * 10 }));
      setFields((prev) => {
        const others = prev.filter((f) => !secItems.some((s) => s.id === f.id));
        return [...others, ...reordered];
      });
    } else {
      const destItems = fields
        .filter((f) => (f.section_ar ?? "") === (destAr ?? "") && (f.section_en ?? "") === (destEn ?? "") && f.id !== activeId)
        .sort((a, b) => a.position - b.position);
      const insertAt = overField ? destItems.findIndex((f) => f.id === overField!.id) : destItems.length;
      const idx = insertAt < 0 ? destItems.length : insertAt;
      const movedActive = { ...activeField, section_ar: destAr, section_en: destEn };
      const newDest = [...destItems.slice(0, idx), movedActive, ...destItems.slice(idx)]
        .map((f, i) => ({ ...f, position: (i + 1) * 10 }));
      setFields((prev) => {
        const untouchedIds = new Set(newDest.map((f) => f.id));
        return [...prev.filter((f) => !untouchedIds.has(f.id)), ...newDest];
      });
    }
    setDirty(true);
  }


  async function saveAll() {
    setSaving(true);
    const original = new Map(originalFieldsRef.current.map((f) => [f.id, f]));
    const changed = fields.filter((f) => {
      const o = original.get(f.id);
      if (!o) return false;
      return (
        o.position !== f.position ||
        o.col_span !== f.col_span ||
        o.is_active !== f.is_active ||
        (o.section_ar ?? "") !== (f.section_ar ?? "") ||
        (o.section_en ?? "") !== (f.section_en ?? "")
      );
    });
    if (changed.length === 0) {
      setSaving(false); setDirty(false);
      toast.info(ar ? "لا يوجد تغييرات" : "No changes to save");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    const results = await Promise.all(
      changed.map((f) => {
        const o = original.get(f.id)!;
        const hidChanged = o.is_active !== f.is_active;
        return supabase.from("customer_field_definitions").update({
          position: f.position,
          col_span: f.col_span,
          is_active: f.is_active,
          section_ar: f.section_ar,
          section_en: f.section_en,
          ...(hidChanged
            ? { hidden_at: !f.is_active ? new Date().toISOString() : null, hidden_by: !f.is_active ? uid : null }
            : {}),
        }).eq("id", f.id);
      }),
    );
    setSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) { toast.error(failed.error.message); return; }
    toast.success(ar ? `تم حفظ ${changed.length} تعديل` : `Saved ${changed.length} change(s)`);
    originalFieldsRef.current = fields.map((f) => ({ ...f }));
    setDirty(false);
  }

  async function discardChanges() {
    const ok = await confirm({
      title: ar ? "تراجع" : "Discard",
      description: ar ? "التراجع عن كل التغييرات؟" : "Discard all changes?",
      confirmText: ar ? "تراجع" : "Discard",
      variant: "destructive",
    });
    if (!ok) return;
    setFields(originalFieldsRef.current.map((f) => ({ ...f })));
    setDirty(false);
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
        {dirty && (
          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {ar ? "تغييرات غير محفوظة" : "Unsaved changes"}
          </Badge>
        )}
        <div className="ms-auto flex items-center gap-2">
          <Select value={entity} onValueChange={async (v) => {
            if (dirty) {
              const ok = await confirm({
                title: ar ? "تغييرات غير محفوظة" : "Unsaved changes",
                description: ar ? "فيه تغييرات غير محفوظة. متأكد؟" : "You have unsaved changes. Continue?",
                confirmText: ar ? "متابعة" : "Continue",
                variant: "destructive",
              });
              if (!ok) return;
            }
            setEntity(v);
          }}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENTITIES.map((e) => (
                <SelectItem key={e.key} value={e.key}>{ar ? e.ar : e.en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)}>
            <Sparkles className="h-4 w-4 me-1" /> {showPreview ? (ar ? "إخفاء المعاينة" : "Hide Preview") : (ar ? "معاينة" : "Preview")}
          </Button>
          <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={discardChanges}>
            <Undo2 className="h-4 w-4 me-1" /> {ar ? "تراجع" : "Discard"}
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={saveAll}>
            <Save className="h-4 w-4 me-1" /> {saving ? (ar ? "حفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNewSectionOpen(true)}>
            <Plus className="h-4 w-4 me-1" /> {ar ? "قسم جديد" : "New Section"}
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDrawerOpen(true); }}>
            <Plus className="h-4 w-4 me-1" /> {ar ? "حقل جديد" : "New Field"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-dashed p-3 flex gap-2 items-start text-xs text-muted-foreground bg-muted/30">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          {ar
            ? "اسحب أي حقل لأي قسم (حتى القسم الفاضي). التعديلات مش بتتحفظ لحد ما تضغط «حفظ». المعاينة اللايف على اليمين بتوريك شكل الشاشة النهائي."
            : "Drag any field into any section (including empty ones). Changes are NOT saved until you press Save. The live preview on the right shows the final form."}
        </div>
      </div>

      <div className={`grid gap-4 ${showPreview ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-1"}`}>
        <div>
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">{ar ? "تحميل..." : "Loading..."}</div>
          ) : fields.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              {ar ? "لا توجد حقول بعد. أضف أول حقل." : "No fields yet. Add your first."}
            </CardContent></Card>
          ) : (
            <BuilderCanvas
              sections={sections}
              optionsByField={optionsByField}
              ar={ar}
              onDragEnd={handleDragEnd}
              onEdit={(f) => { setEditing(f); setDrawerOpen(true); }}
              onColSpan={updateColSpan}
              onToggleActive={toggleActive}
              onDelete={removeField}
              onRenameSection={renameSection}
              onDeleteSection={deleteSection}
            />
          )}
        </div>
        {showPreview && !loading && fields.length > 0 && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <LivePreview sections={sections} optionsByField={optionsByField} ar={ar} />
          </div>
        )}
      </div>


      <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <DialogContent dir={dir} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ar ? "قسم جديد" : "New Section"}</DialogTitle>
            <DialogDescription className="text-xs">
              {ar
                ? "اكتب اسم القسم بالعربي والإنجليزي، وبعدين اسحب الحقول جواه. مش هيتحفظ إلا لما تدوس «حفظ»."
                : "Enter AR/EN names, then drag fields into it. It's not persisted until you press Save."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">{ar ? "الاسم بالعربي" : "Name (AR)"}</Label>
              <Input
                dir="rtl"
                value={newSectionAr}
                onChange={(e) => setNewSectionAr(e.target.value)}
                placeholder={ar ? "مثلاً: بيانات الدفع" : "مثلاً: بيانات الدفع"}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") submitNewSection(); }}
              />
            </div>
            <div>
              <Label className="text-xs">{ar ? "الاسم بالإنجليزي" : "Name (EN)"}</Label>
              <Input
                dir="ltr"
                value={newSectionEn}
                onChange={(e) => setNewSectionEn(e.target.value)}
                placeholder="e.g. Payment Info"
                onKeyDown={(e) => { if (e.key === "Enter") submitNewSection(); }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewSectionOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitNewSection}>
              <Plus className="h-4 w-4 me-1" /> {ar ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

type Section = {
  key: string;
  sectionAr: string;
  sectionEn: string;
  label: string;
  items: FieldDef[];
};

function BuilderCanvas({
  sections, optionsByField, ar, onDragEnd, onEdit, onColSpan, onToggleActive, onDelete, onRenameSection, onDeleteSection,
}: {
  sections: Section[];
  optionsByField: Record<string, FieldOption[]>;
  ar: boolean;
  onDragEnd: (e: DragEndEvent) => void;
  onEdit: (f: FieldDef) => void;
  onColSpan: (f: FieldDef, span: number) => void;
  onToggleActive: (f: FieldDef) => void;
  onDelete: (f: FieldDef) => void;
  onRenameSection: (oldAr: string, oldEn: string, newAr: string, newEn: string) => void;
  onDeleteSection: (secKey: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const fieldIds = sections.flatMap((s) => s.items.map((f) => f.id));
  const sectionIds = sections.map((s) => `SEC::${s.key}`);
  return (
    <DndContext sensors={sensors} collisionDetection={sectionAwareCollision} onDragEnd={onDragEnd}>
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        <SortableContext items={fieldIds} strategy={rectSortingStrategy}>
          <div className="space-y-4">
            {sections.map((sec) => (
              <SectionGrid
                key={sec.key}
                section={sec}
                optionsByField={optionsByField}
                ar={ar}
                onEdit={onEdit}
                onColSpan={onColSpan}
                onToggleActive={onToggleActive}
                onDelete={onDelete}
                onRenameSection={onRenameSection}
                onDeleteSection={onDeleteSection}
              />
            ))}
          </div>
        </SortableContext>
      </SortableContext>
    </DndContext>
  );
}


function SectionGrid({
  section, optionsByField, ar, onEdit, onColSpan, onToggleActive, onDelete, onRenameSection, onDeleteSection,
}: {
  section: Section;
  optionsByField: Record<string, FieldOption[]>;
  ar: boolean;
  onEdit: (f: FieldDef) => void;
  onColSpan: (f: FieldDef, span: number) => void;
  onToggleActive: (f: FieldDef) => void;
  onDelete: (f: FieldDef) => void;
  onRenameSection: (oldAr: string, oldEn: string, newAr: string, newEn: string) => void;
  onDeleteSection: (secKey: string) => void;
}) {
  const { items, sectionAr, sectionEn, label } = section;
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `__sec:${section.key}` });
  const {
    attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging,
  } = useSortable({ id: `SEC::${section.key}` });
  const [renaming, setRenaming] = useState(false);
  const [nAr, setNAr] = useState(sectionAr);
  const [nEn, setNEn] = useState(sectionEn);

  useEffect(() => { setNAr(sectionAr); setNEn(sectionEn); }, [sectionAr, sectionEn]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const hasSystem = items.some((f) => f.is_system);

  return (
    <div ref={setSortRef} style={style} className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label={ar ? "اسحب القسم" : "Drag section"}
          title={ar ? "اسحب لإعادة ترتيب الأقسام" : "Drag to reorder sections"}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {renaming ? (
          <>
            <Input value={nAr} onChange={(e) => setNAr(e.target.value)} placeholder={ar ? "عربي" : "AR"} className="h-7 text-xs w-40" />
            <Input value={nEn} onChange={(e) => setNEn(e.target.value)} placeholder="EN" className="h-7 text-xs w-40" />
            <Button size="icon" variant="outline" className="h-7 w-7 text-primary" onClick={() => { onRenameSection(sectionAr, sectionEn, nAr, nEn); setRenaming(false); }}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => { setNAr(sectionAr); setNEn(sectionEn); setRenaming(false); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</h3>
            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setRenaming(true)} title={ar ? "إعادة تسمية القسم" : "Rename section"}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 text-destructive hover:text-destructive disabled:text-muted-foreground"
              onClick={() => onDeleteSection(section.key)}
              disabled={hasSystem}
              title={hasSystem ? (ar ? "يحتوي على حقول نظام" : "Contains system fields") : (ar ? "حذف القسم" : "Delete section")}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
      <div
        ref={setDropRef}
        className={`grid grid-cols-12 gap-2 rounded-lg border bg-background/60 p-2 min-h-[70px] transition-colors ${isOver ? "border-primary bg-primary/5" : ""}`}
      >
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
        {items.length === 0 && (
          <div className="col-span-12 text-center text-xs text-muted-foreground py-4">
            {ar ? "اسحب حقل هنا" : "Drop a field here"}
          </div>
        )}
      </div>
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

      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t">
        <div className="flex items-center gap-0.5 flex-wrap">
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
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" onClick={onToggleActive} title={field.is_active ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}>
            {field.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" onClick={onEdit} title={ar ? "تعديل" : "Edit"}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!field.is_system && (
            <Button variant="outline" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={onDelete} title={ar ? "حذف" : "Delete"}>
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

    // Duplicate-label guard (AR + EN labels must be unique). Value is system-generated.
    if (needsOptions(fieldType)) {
      const filled = localOptions.filter((o) => o.label_ar.trim() || o.label_en.trim());
      const incomplete = filled.find((o) => !o.label_ar.trim() || !o.label_en.trim());
      if (incomplete) { toast.error(ar ? "املأ الاسم بالعربي والإنجليزي لكل خيار" : "Fill AR + EN for every option"); return; }
      const seen = { ar: new Set<string>(), en: new Set<string>() };
      for (const o of filled) {
        const la = o.label_ar.trim();
        const le = o.label_en.trim().toLowerCase();
        if (seen.ar.has(la)) { toast.error(ar ? `الاسم العربي "${o.label_ar}" مكرر` : `Arabic label "${o.label_ar}" is duplicated`); return; }
        if (seen.en.has(le)) { toast.error(ar ? `الاسم الإنجليزي "${o.label_en}" مكرر` : `English label "${o.label_en}" is duplicated`); return; }
        seen.ar.add(la); seen.en.add(le);
      }
    }


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

    if (fieldId && needsOptions(fieldType) && !isReferenceField(editing)) {
      await supabase.from("customer_field_options").delete().eq("field_id", fieldId);
      const usedValues = new Set<string>();
      const genValue = (labelEn: string, labelAr: string) => {
        const base = slugify(labelEn) || slugify(labelAr) || "option";
        let v = base;
        let n = 2;
        while (usedValues.has(v)) v = `${base}_${n++}`;
        usedValues.add(v);
        return v;
      };
      const rows = localOptions
        .filter((o) => o.label_ar.trim() && o.label_en.trim())
        .map((o, i) => ({
          field_id: fieldId!, value: genValue(o.label_en, o.label_ar),
          label_ar: o.label_ar.trim(), label_en: o.label_en.trim(),
          position: (i + 1) * 10, is_active: o.is_active,
        }));
      if (rows.length) {
        const { error } = await supabase.from("customer_field_options").insert(rows);
        if (error) { setSaving(false); toast.error(error.message); return; }
      }
    } else if (fieldId && !needsOptions(fieldType) && !isReferenceField(editing)) {
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
              <Input autoFocus value={labelAr} onChange={(e) => setLabelAr(e.target.value)} />
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
            {isReferenceField(editing) ? (
              <div className="flex items-center gap-2 rounded border bg-muted/50 px-3 py-2 text-sm">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{ar ? REFERENCE_FIELDS[editing!.key].ar : REFERENCE_FIELDS[editing!.key].en}</span>
              </div>
            ) : (
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)} disabled={isSystem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{ar ? t.ar : t.en}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
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
                <Label className="flex items-center gap-1.5">
                  {ar ? "Regex Pattern (اختياري)" : "Regex pattern (optional)"}
                  <RegexHelper ar={ar} onPick={(p) => setValidation((v) => ({ ...v, pattern: p }))} />
                </Label>
                <Input value={validation.pattern ?? ""} onChange={(e) => setValidation((v) => ({ ...v, pattern: e.target.value }))} placeholder="^[0-9]{14}$" className="font-mono text-sm" dir="ltr" />
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

          {needsOptions(fieldType) && !isReferenceField(editing) && (
            <div className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-bold flex items-center gap-1.5">
                  {ar ? "قيم القائمة" : "List Options"}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {ar ? "(القيمة التقنية تُولَّد تلقائيًا)" : "(technical value auto-generated)"}
                  </span>
                </Label>
                <Button size="sm" variant="outline" onClick={() => setLocalOptions((o) => [...o, { value: "", label_ar: "", label_en: "", is_active: true }])}>
                  <Plus className="h-3 w-3 me-1" /> {ar ? "قيمة" : "Option"}
                </Button>
              </div>
              {localOptions.length === 0 && <p className="text-xs text-muted-foreground">{ar ? "لا توجد قيم بعد." : "No options yet."}</p>}
              {localOptions.map((opt, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1 items-center">
                  <Input autoFocus={i === localOptions.length - 1 && !opt.label_ar} placeholder={ar ? "بالعربي" : "AR"} value={opt.label_ar} onChange={(e) => setLocalOptions((list) => list.map((o, j) => j === i ? { ...o, label_ar: e.target.value } : o))} className="text-xs h-8" dir="rtl" />
                  <Input placeholder={ar ? "بالإنجليزي" : "EN"} value={opt.label_en} onChange={(e) => setLocalOptions((list) => list.map((o, j) => j === i ? { ...o, label_en: e.target.value } : o))} className="text-xs h-8" dir="ltr" />
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

// ---------- Custom collision: prefer field under pointer, then section droppable ----------

const sectionAwareCollision: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  const draggingSection = activeId.startsWith("SEC::");

  if (draggingSection) {
    // When reordering sections, only consider section sortables.
    const filtered = {
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        String(c.id).startsWith("SEC::"),
      ),
    };
    const pw = pointerWithin(filtered);
    if (pw.length) return pw;
    return closestCenter(filtered);
  }

  // Dragging a field: prefer another field under the pointer, then the
  // section drop zone (`__sec:`), never the outer section sortable (`SEC::`).
  const pw = pointerWithin(args);
  const fieldHit = pw.find((c) => {
    const id = String(c.id);
    return !id.startsWith("__sec:") && !id.startsWith("SEC::");
  });
  if (fieldHit) return [fieldHit];
  const secHit = pw.find((c) => String(c.id).startsWith("__sec:"));
  if (secHit) return [secHit];

  const fieldOnly = {
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => !String(c.id).startsWith("SEC::"),
    ),
  };
  return closestCenter(fieldOnly);
};

// ---------- Live Preview of the final form ----------

function LivePreview({
  sections, optionsByField, ar,
}: {
  sections: Section[];
  optionsByField: Record<string, FieldOption[]>;
  ar: boolean;
}) {
  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide">
            {ar ? "معاينة الشاشة" : "Form Preview"}
          </span>
          <span className="ms-auto text-[10px] text-muted-foreground">
            {ar ? "شكل الشاشة النهائي" : "Live output"}
          </span>
        </div>
        {sections.map((sec) => {
          const visible = sec.items.filter((f) => f.is_active);
          if (visible.length === 0) return null;
          return (
            <div key={sec.key} className="space-y-2">
              <div className="text-xs font-bold text-primary/80">{sec.label}</div>
              <div className="grid grid-cols-12 gap-2">
                {visible.map((f) => (
                  <PreviewField
                    key={f.id}
                    field={f}
                    options={optionsByField[f.id] ?? []}
                    ar={ar}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PreviewField({
  field, options, ar,
}: {
  field: FieldDef;
  options: FieldOption[];
  ar: boolean;
}) {
  const span = Math.max(1, Math.min(12, field.col_span || 12));
  const label = ar ? field.label_ar : field.label_en;
  const placeholder = (ar ? field.placeholder_ar : field.placeholder_en) ?? "";
  const t = field.field_type;

  return (
    <div style={{ gridColumn: `span ${span} / span ${span}` }} className="space-y-1">
      <Label className="text-xs flex items-center gap-1">
        {label}
        {field.is_required && <span className="text-destructive">*</span>}
      </Label>
      {t === "textarea" ? (
        <Textarea disabled placeholder={placeholder} rows={2} className="text-xs" />
      ) : t === "checkbox" ? (
        <div className="flex items-center gap-2 h-8"><Checkbox disabled /><span className="text-xs text-muted-foreground">{placeholder || label}</span></div>
      ) : t === "dropdown" || t === "multiselect" ? (
        <Select disabled>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={placeholder || (ar ? "اختر..." : "Select...")} /></SelectTrigger>
          <SelectContent>
            {options.slice(0, 5).map((o) => (
              <SelectItem key={o.id} value={o.value}>{ar ? o.label_ar : o.label_en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : t === "bilingual_text" ? (
        <div className="grid grid-cols-2 gap-1">
          <Input disabled placeholder="AR" className="h-8 text-xs" />
          <Input disabled placeholder="EN" className="h-8 text-xs" />
        </div>
      ) : (
        <Input
          disabled
          type={t === "number" ? "number" : t === "date" ? "date" : t === "email" ? "email" : "text"}
          placeholder={placeholder || label}
          className="h-8 text-xs"
        />
      )}
    </div>
  );
}

// ---------- Regex Helper Popover ----------

const REGEX_PRESETS: { ar: string; en: string; pattern: string; example: string }[] = [
  { ar: "أرقام فقط", en: "Digits only", pattern: "^[0-9]+$", example: "12345" },
  { ar: "حروف فقط (عربي/إنجليزي)", en: "Letters only (AR/EN)", pattern: "^[\\p{L}\\s]+$", example: "أحمد / Ahmed" },
  { ar: "موبايل مصري (11 رقم)", en: "Egyptian mobile (11 digits)", pattern: "^01[0125][0-9]{8}$", example: "01012345678" },
  { ar: "رقم قومي مصري (14 رقم)", en: "Egyptian National ID (14 digits)", pattern: "^[0-9]{14}$", example: "29001011234567" },
  { ar: "بريد إلكتروني", en: "Email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", example: "name@example.com" },
  { ar: "رابط ويب (URL)", en: "URL", pattern: "^https?://.+", example: "https://example.com" },
  { ar: "كود بريدي (5 أرقام)", en: "Postal code (5 digits)", pattern: "^[0-9]{5}$", example: "11511" },
  { ar: "IBAN مصري", en: "Egyptian IBAN", pattern: "^EG[0-9]{27}$", example: "EG380019000500000000263180002" },
];

function RegexHelper({ ar, onPick }: { ar: boolean; onPick: (pattern: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-primary" title={ar ? "أمثلة جاهزة" : "Ready examples"}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="text-xs font-bold mb-1.5 px-1">
          {ar ? "اختر نمط جاهز" : "Pick a ready pattern"}
        </div>
        <div className="max-h-72 overflow-y-auto space-y-1">
          {REGEX_PRESETS.map((p) => (
            <button
              key={p.pattern}
              type="button"
              onClick={() => onPick(p.pattern)}
              className="w-full text-start rounded p-1.5 hover:bg-muted transition-colors"
            >
              <div className="text-xs font-medium">{ar ? p.ar : p.en}</div>
              <div className="text-[10px] font-mono text-muted-foreground truncate" dir="ltr">{p.pattern}</div>
              <div className="text-[10px] text-muted-foreground" dir="ltr">
                {ar ? "مثال: " : "e.g. "}<span className="font-mono">{p.example}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground mt-2 px-1 border-t pt-1.5">
          {ar
            ? "الـ Regex بيتحقق من شكل النص. مثلاً ^[0-9]+$ يعني أرقام بس."
            : "Regex validates the text shape. e.g. ^[0-9]+$ means digits only."}
        </div>
      </PopoverContent>
    </Popover>
  );
}



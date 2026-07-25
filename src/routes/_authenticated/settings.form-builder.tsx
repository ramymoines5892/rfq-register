import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCanManageFormFields,
  useFormBuilderData,
  usePersistFieldChanges,
  useSaveFieldDefinition,
  useSoftDeleteField,
  useSoftDeleteFieldsBulk,
} from "@/modules/formBuilder/queries";
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
    try {
      await softDeleteM.mutateAsync(f.id);
      toast.success(ar ? "تم النقل لسلة المحذوفات" : "Moved to trash");
      loadAll();
    } catch (e) { toast.error((e as Error).message); }
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
      try {
        await softDeleteBulkM.mutateAsync(sec.items.map((f) => f.id));
      } catch (e) { toast.error((e as Error).message); return; }
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
      setDirty(false);
      toast.info(ar ? "لا يوجد تغييرات" : "No changes to save");
      return;
    }
    try {
      await persistM.mutateAsync({ changed, original });
    } catch (e) { toast.error((e as Error).message); return; }
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

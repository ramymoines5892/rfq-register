import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputIcon } from "@/components/ui/input-icon";
import {
  LayoutGrid,
  Languages,
  FileText,
  ShieldCheck,
  Bell,
  Trash2,
  Search,
  GripVertical,
  Maximize2,
  Minimize2,
  Square,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsHome,
});

type Size = "sm" | "md" | "lg";

type Item = {
  id: string;
  to: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  keywords: string; // for search
  icon: typeof LayoutGrid;
  group: "system" | "workspace" | "admin";
  enabled: boolean;
  soon?: boolean;
};

const DEFAULT_ITEMS: Item[] = [
  {
    id: "form-builder",
    to: "/settings/form-builder",
    titleAr: "منشئ الحقول",
    titleEn: "Form Builder",
    descAr: "حرّك الحقول بالسحب والإفلات وحدّد شكل ظهورها في كل شاشة.",
    descEn: "Drag & drop fields, decide column widths, design each screen.",
    keywords: "fields form builder حقول نماذج تصميم",
    icon: LayoutGrid,
    group: "workspace",
    enabled: true,
  },
  {
    id: "notifications",
    to: "/settings/notifications",
    titleAr: "الإشعارات",
    titleEn: "Notifications",
    descAr: "فعّل/أوقف الإشعارات، حدد التذكير الدوري، الصوت وأنواع الإشعارات.",
    descEn: "Enable notifications, reminder interval, sound and categories.",
    keywords: "notifications alerts bell إشعارات تنبيهات جرس",
    icon: Bell,
    group: "system",
    enabled: true,
  },
  {
    id: "trash",
    to: "/settings/trash",
    titleAr: "سلة المحذوفات",
    titleEn: "Trash",
    descAr: "استعرض العناصر المخفية أو المحذوفة وقم باستعادتها.",
    descEn: "Review hidden or deleted items and restore them.",
    keywords: "trash deleted recycle bin سلة محذوفات مخفي",
    icon: Trash2,
    group: "admin",
    enabled: true,
  },
  {
    id: "language",
    to: "/settings/language",
    titleAr: "اللغة والتوطين",
    titleEn: "Language & Locale",
    descAr: "افتراضي اللغة، اتجاه القراءة، وتنسيقات التاريخ والأرقام.",
    descEn: "Default language, direction, date/number formats.",
    keywords: "language locale rtl arabic english اللغة توطين",
    icon: Languages,
    group: "system",
    enabled: false,
    soon: true,
  },
  {
    id: "reports",
    to: "/settings/reports",
    titleAr: "التقارير",
    titleEn: "Reports",
    descAr: "قوالب التقارير الافتراضية وخيارات التصدير.",
    descEn: "Report templates and export defaults.",
    keywords: "reports export pdf excel تقارير تصدير",
    icon: FileText,
    group: "workspace",
    enabled: false,
    soon: true,
  },
  {
    id: "permissions",
    to: "/settings/permissions",
    titleAr: "الصلاحيات",
    titleEn: "Permissions",
    descAr: "حدد من يقدر يفتح كل جزء من الإعدادات.",
    descEn: "Control who can access each settings section.",
    keywords: "permissions roles access الصلاحيات ادوار",
    icon: ShieldCheck,
    group: "admin",
    enabled: false,
    soon: true,
  },
];

const LS_ORDER = "settings.layout.order.v1";
const LS_SIZES = "settings.layout.sizes.v1";
const LS_GROUPED = "settings.layout.grouped.v1";

function loadOrder(defaults: string[]): string[] {
  try {
    const raw = localStorage.getItem(LS_ORDER);
    if (!raw) return defaults;
    const arr = JSON.parse(raw) as string[];
    // preserve any newly added items
    const missing = defaults.filter((id) => !arr.includes(id));
    return [...arr.filter((id) => defaults.includes(id)), ...missing];
  } catch {
    return defaults;
  }
}

function loadSizes(): Record<string, Size> {
  try {
    return JSON.parse(localStorage.getItem(LS_SIZES) ?? "{}");
  } catch {
    return {};
  }
}

const sizeToSpan: Record<Size, string> = {
  sm: "col-span-1",
  md: "col-span-1 sm:col-span-2",
  lg: "col-span-1 sm:col-span-2 lg:col-span-3",
};

function SortableCard({
  item,
  size,
  editing,
  onSize,
  ar,
}: {
  item: Item;
  size: Size;
  editing: boolean;
  onSize: (id: string, s: Size) => void;
  ar: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editing,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;
  const Icon = item.icon;

  const card = (
    <Card
      className={`h-full transition-shadow ${item.enabled ? "hover:shadow-md" : "opacity-60"} ${
        editing ? "ring-1 ring-dashed ring-primary/40" : ""
      }`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          {editing && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ms-1"
              aria-label="Drag"
              type="button"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="font-semibold truncate">{ar ? item.titleAr : item.titleEn}</h3>
          {item.soon && (
            <span className="ms-auto text-[10px] uppercase text-muted-foreground shrink-0">
              {ar ? "قريبًا" : "Soon"}
            </span>
          )}
          {editing && !item.soon && (
            <div className="ms-auto flex items-center gap-0.5 shrink-0">
              <Button
                size="icon"
                variant={size === "sm" ? "default" : "ghost"}
                className="h-6 w-6"
                onClick={(e) => {
                  e.preventDefault();
                  onSize(item.id, "sm");
                }}
                title={ar ? "صغير" : "Small"}
                type="button"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant={size === "md" ? "default" : "ghost"}
                className="h-6 w-6"
                onClick={(e) => {
                  e.preventDefault();
                  onSize(item.id, "md");
                }}
                title={ar ? "متوسط" : "Medium"}
                type="button"
              >
                <Square className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant={size === "lg" ? "default" : "ghost"}
                className="h-6 w-6"
                onClick={(e) => {
                  e.preventDefault();
                  onSize(item.id, "lg");
                }}
                title={ar ? "كبير" : "Large"}
                type="button"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {ar ? item.descAr : item.descEn}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div ref={setNodeRef} style={style} className={sizeToSpan[size]}>
      {editing || !item.enabled ? (
        <div className={editing ? "pointer-events-auto" : ""}>{card}</div>
      ) : (
        <Link to={item.to} className="block h-full">
          {card}
        </Link>
      )}
    </div>
  );
}

function SettingsHome() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const defaultIds = useMemo(() => DEFAULT_ITEMS.map((i) => i.id), []);
  const [order, setOrder] = useState<string[]>(defaultIds);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [editing, setEditing] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [q, setQ] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    setOrder(loadOrder(defaultIds));
    setSizes(loadSizes());
    setGrouped(localStorage.getItem(LS_GROUPED) === "1");
    loaded.current = true;
  }, [defaultIds]);

  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(LS_ORDER, JSON.stringify(order));
  }, [order]);
  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(LS_SIZES, JSON.stringify(sizes));
  }, [sizes]);
  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(LS_GROUPED, grouped ? "1" : "0");
  }, [grouped]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(() => {
    const m = new Map<string, Item>();
    for (const it of DEFAULT_ITEMS) m.set(it.id, it);
    return m;
  }, []);

  const search = q.trim().toLowerCase();
  const orderedItems = order.map((id) => byId.get(id)).filter(Boolean) as Item[];
  const visible = search
    ? orderedItems.filter(
        (it) =>
          (ar ? it.titleAr : it.titleEn).toLowerCase().includes(search) ||
          it.keywords.toLowerCase().includes(search) ||
          it.to.toLowerCase().includes(search),
      )
    : orderedItems;

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = [...prev];
      next.splice(oldIndex, 1);
      next.splice(newIndex, 0, String(active.id));
      return next;
    });
  };

  const setSize = (id: string, s: Size) => setSizes((prev) => ({ ...prev, [id]: s }));
  const resetLayout = () => {
    setOrder(defaultIds);
    setSizes({});
    setGrouped(false);
  };

  const groups: { key: Item["group"]; labelAr: string; labelEn: string }[] = [
    { key: "workspace", labelAr: "مساحة العمل", labelEn: "Workspace" },
    { key: "system", labelAr: "النظام", labelEn: "System" },
    { key: "admin", labelAr: "الإدارة", labelEn: "Admin" },
  ];

  const renderGrid = (items: Item[]) => (
    <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr">
        {items.map((it) => (
          <SortableCard
            key={it.id}
            item={it}
            size={sizes[it.id] ?? "sm"}
            editing={editing}
            onSize={setSize}
            ar={ar}
          />
        ))}
      </div>
    </SortableContext>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div>
          <h2 className="text-2xl font-bold leading-tight">
            {ar ? "إعدادات النظام" : "System Settings"}
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {ar
              ? "اسحب الكروت لإعادة ترتيبها، غيّر حجمها، أو ابحث بكلمة."
              : "Drag cards to reorder, resize them, or search."}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <InputIcon
            leftIcon={<Search />}
            placeholder={ar ? "بحث في الإعدادات…" : "Search settings…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            clearable
            onClear={() => setQ("")}
            containerClassName="w-56"
            className="h-9"
          />
          <Button
            variant={grouped ? "default" : "outline"}
            size="sm"
            onClick={() => setGrouped((v) => !v)}
            className="h-9"
          >
            <Sparkles className="h-3.5 w-3.5 me-1.5" />
            {ar ? "تجميع" : "Group"}
          </Button>
          <Button
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing((v) => !v)}
            className="h-9"
          >
            {editing ? (
              <>
                <Check className="h-3.5 w-3.5 me-1.5" /> {ar ? "تم" : "Done"}
              </>
            ) : (
              <>
                <LayoutGrid className="h-3.5 w-3.5 me-1.5" /> {ar ? "تخصيص" : "Customize"}
              </>
            )}
          </Button>
          {editing && (
            <Button variant="ghost" size="sm" onClick={resetLayout} className="h-9">
              <RotateCcw className="h-3.5 w-3.5 me-1.5" />
              {ar ? "استعادة" : "Reset"}
            </Button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {grouped && !search ? (
          <div className="space-y-6">
            {groups.map((g) => {
              const items = visible.filter((i) => i.group === g.key);
              if (!items.length) return null;
              return (
                <section key={g.key}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {ar ? g.labelAr : g.labelEn}
                  </h3>
                  {renderGrid(items)}
                </section>
              );
            })}
          </div>
        ) : (
          renderGrid(visible)
        )}
      </DndContext>

      {visible.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {ar ? "لا توجد نتائج" : "No matches"}
        </div>
      )}
    </div>
  );
}

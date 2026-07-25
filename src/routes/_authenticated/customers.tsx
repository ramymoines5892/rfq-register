import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccess } from "@/hooks/useAccess";
import { useCustomers, useSoftDeleteCustomer } from "@/modules/customers/queries";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputIcon } from "@/components/ui/input-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Users, Settings2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BilingualText, pickLangValue } from "@/lib/bilingual";
import { CURRENCIES, type Customer } from "@/modules/customers/types";
import { CustomerSheet } from "@/modules/customers/components/CustomerSheet";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
  head: () => ({
    meta: [
      { title: "العملاء" },
      { name: "description", content: "إدارة العملاء والأشخاص المسؤولين والحسابات البنكية" },
    ],
  }),
});

function CustomersPage() {
  const { t, lang } = useI18n();
  const access = useAccess();
  const { data: customers = [], isLoading: loading, refetch } = useCustomers();
  const deleteCustomer = useSoftDeleteCustomer();

  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = () => { void refetch(); };

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (currencyFilter !== "all" && c.currency !== currencyFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      const hay = [
        c.name,
        c.name_ar,
        c.name_en,
        c.tax_id,
        c.email,
        c.phone,
        c.city,
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());
      return hay.some((h) => h.includes(s));
    });
  }, [customers, search, currencyFilter]);

  async function handleDelete(c: Customer) {
    try {
      await deleteCustomer.mutateAsync(c.id);
      toast.success(lang === "ar" ? "اتنقل لسلة المحذوفات (الـ Owner يقدر يرجّعه)" : "Moved to trash (Owner can restore)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setSheetOpen(true);
  }

  const displayName = (c: Customer) => pickLangValue(c as any, "name", lang).value || c.name;

  return (
    <div className="min-h-screen">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold leading-tight">{t("customers")}</h1>
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? `${customers.length} عميل`
                  : `${customers.length} customer${customers.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {access.canManageFormFields && (
              <Link to="/settings/form-builder">
                <Button variant="outline" size="sm" className="gap-1.5" title={lang === "ar" ? "إعدادات حقول العميل" : "Customer Field Settings"}>
                  <Settings2 className="h-4 w-4" /> {lang === "ar" ? "إعدادات الحقول" : "Field Settings"}
                </Button>
              </Link>
            )}

            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("addCustomer")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <InputIcon
              leftIcon={<Search />}
              placeholder={
                lang === "ar"
                  ? "ابحث بالاسم (عربي أو إنجليزي) / رقم ضريبي / إيميل / تليفون"
                  : "Search name (AR or EN) / tax id / email / phone"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              clearable
              onClear={() => setSearch("")}
            />
          </div>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "ar" ? "كل العملات" : "All currencies"}</SelectItem>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              {customers.length === 0 ? (
                <div className="space-y-3">
                  <div>{t("noCustomersYet")}</div>
                  <Button onClick={openNew} size="sm">
                    <Plus className="h-4 w-4 me-1" /> {t("addCustomer")}
                  </Button>
                </div>
              ) : (
                lang === "ar" ? "لا توجد نتائج" : "No results"
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{t("customerName")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("industry")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("email")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("phone")}</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {lang === "ar" ? "المدينة" : "City"}
                  </TableHead>
                  <TableHead className="w-20">{t("currency")}</TableHead>
                  <TableHead className="w-24 text-end">
                    {lang === "ar" ? "إجراءات" : "Actions"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const dispName = displayName(c);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => openEdit(c)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                            {dispName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate">
                              <BilingualText row={c as any} base="name" />
                            </div>
                            {c.tax_id && (
                              <div className="text-[10px] text-muted-foreground truncate" dir="ltr">
                                {c.tax_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        <BilingualText row={c as any} base="industry" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground" dir="ltr">
                        {c.email || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground" dir="ltr">
                        {c.phone || "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.currency}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
                                <AlertDialogDescription>{dispName}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(c)}>
                                  {t("delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <CustomerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customer={editing}
        onSaved={load}
      />
    </div>
  );
}

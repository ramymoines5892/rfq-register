import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useProfiles,
  useUserRoles,
  useCurrentUserId,
  useSetUserRole,
  useRemoveFromTeam,
} from "@/modules/hr/queries";
import type { AppRole } from "@/modules/hr/api";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "إدارة الفريق" }] }),
});

function TeamPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const { data: me = "" } = useCurrentUserId();
  const { data: profiles = [], isLoading: loadingP } = useProfiles();
  const { data: roles = [], isLoading: loadingR } = useUserRoles();
  const setRoleMut = useSetUserRole();
  const removeMut = useRemoveFromTeam();
  const [inviteEmail, setInviteEmail] = useState("");

  const loading = loadingP || loadingR;
  const mine = roles.find((r) => r.user_id === me);
  const myRole = mine?.role ?? null;
  const canManage = myRole === "owner" || myRole === "admin";

  function rolesFor(uid: string): AppRole[] {
    return roles.filter((r) => r.user_id === uid).map((r) => r.role);
  }

  async function setRole(userId: string, newRole: AppRole) {
    try {
      await setRoleMut.mutateAsync({ userId, role: newRole });
      toast.success(t("saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeFromTeam(userId: string) {
    const ok = await confirm({ description: t("confirmDelete"), variant: "destructive" });
    if (!ok) return;
    try {
      await removeMut.mutateAsync(userId);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addByEmail() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const prof = profiles.find((p) => p.email.toLowerCase() === email);
    if (!prof) { toast.error(t("userNotFound")); return; }
    await setRole(prof.id, "member");
    setInviteEmail("");
  }

  const inTeam = profiles.filter((p) => rolesFor(p.id).length > 0);
  const notInTeam = profiles.filter((p) => rolesFor(p.id).length === 0);

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{t("backToQuotes")}</Button></Link>
          <h1 className="text-lg font-bold">{t("teamMembers")}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {!canManage && (
          <Card><CardContent className="py-4 text-sm text-muted-foreground">{t("onlyAdminsCanManage")}</CardContent></Card>
        )}

        {canManage && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-semibold">{t("addByEmail")}</div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  dir="ltr"
                />
                <Button onClick={addByEmail}><UserPlus className="h-4 w-4 me-1" />{t("addToTeam")}</Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("userNotFound")}</p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : (
          <>
            <div className="text-sm font-semibold px-1">{t("teamMembers")} ({inTeam.length})</div>
            <div className="grid gap-2">
              {inTeam.map((p) => {
                const rs = rolesFor(p.id);
                const primary: AppRole = rs.includes("owner") ? "owner" : rs.includes("admin") ? "admin" : "member";
                const isSelf = p.id === me;
                return (
                  <Card key={p.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.full_name || p.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {canManage && primary !== "owner" && !isSelf ? (
                          <Select value={primary} onValueChange={(v) => setRole(p.id, v as AppRole)}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                              <SelectItem value="member">{t("roleMember")}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={primary === "owner" ? "default" : "secondary"}>
                            {primary === "owner" ? t("roleOwner") : primary === "admin" ? t("roleAdmin") : t("roleMember")}
                          </Badge>
                        )}
                        {canManage && primary !== "owner" && !isSelf && (
                          <Button variant="ghost" size="icon" onClick={() => removeFromTeam(p.id)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {canManage && notInTeam.length > 0 && (
              <>
                <div className="text-sm font-semibold px-1 pt-4">{t("notInTeam")} ({notInTeam.length})</div>
                <div className="grid gap-2">
                  {notInTeam.map((p) => (
                    <Card key={p.id}>
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.full_name || p.email}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setRole(p.id, "member")}>
                          <UserPlus className="h-4 w-4 me-1" />{t("addToTeam")}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

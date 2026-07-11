import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendInput = { quoteId: string };

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64Encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function encodeHeader(s: string): string {
  // MIME encoded-word for non-ASCII
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return `=?UTF-8?B?${b64}?=`;
}

export const sendQuoteForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendInput) => {
    if (!data?.quoteId || typeof data.quoteId !== "string") throw new Error("quoteId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load quote
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", data.quoteId)
      .single();
    if (qErr || !quote) throw new Error(qErr?.message ?? "Quote not found");
    if (quote.user_id !== userId) throw new Error("Forbidden");
    if (!quote.workflow_template_id) throw new Error("No workflow selected");

    // Current stage (or first)
    let stageId = quote.current_stage_id as string | null;
    if (!stageId) {
      const { data: firstStage } = await supabase
        .from("workflow_stages")
        .select("id")
        .eq("template_id", quote.workflow_template_id)
        .order("position")
        .limit(1)
        .maybeSingle();
      stageId = firstStage?.id ?? null;
    }
    if (!stageId) throw new Error("No stages configured");

    const { data: stage } = await supabase
      .from("workflow_stages")
      .select("id, name")
      .eq("id", stageId)
      .single();

    // Approvers
    const { data: sa } = await supabase
      .from("workflow_stage_approvers")
      .select("approver_id")
      .eq("stage_id", stageId);
    const approverIds = (sa ?? []).map((r: { approver_id: string }) => r.approver_id);
    if (approverIds.length === 0) throw new Error("No approvers for this stage");

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", approverIds);
    const recipients = (profs ?? []).map((p: { email: string }) => p.email).filter(Boolean);
    if (recipients.length === 0) throw new Error("No recipient emails found");

    // Attachments
    const { data: atts } = await supabase
      .from("quote_attachments")
      .select("file_name, storage_path, content_type")
      .eq("quote_id", quote.id);

    const attachmentParts: Array<{ filename: string; contentType: string; b64: string }> = [];
    for (const a of atts ?? []) {
      const { data: blob, error: dErr } = await supabase.storage
        .from("quote-attachments")
        .download(a.storage_path);
      if (dErr || !blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      attachmentParts.push({
        filename: a.file_name,
        contentType: a.content_type || "application/octet-stream",
        b64: b64Encode(buf),
      });
    }

    // Sender profile
    const { data: me } = await supabase.from("profiles").select("email, full_name").eq("id", userId).single();
    const fromEmail = me?.email ?? "";
    const fromName = me?.full_name ?? fromEmail;

    const subject = `طلب موافقة على عرض سعر - ${quote.supplier_name} / Approval request`;
    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <h2>طلب موافقة على عرض سعر</h2>
        <p><b>المورد / Supplier:</b> ${escapeHtml(quote.supplier_name)}</p>
        <p><b>المرجع / Reference:</b> ${escapeHtml(quote.reference ?? "-")}</p>
        <p><b>المبلغ / Amount:</b> ${escapeHtml(String(quote.amount ?? "-"))} ${escapeHtml(quote.currency ?? "")}</p>
        <p><b>تاريخ الاستلام / Received:</b> ${escapeHtml(quote.received_date ?? "-")}</p>
        <p><b>تاريخ الانتهاء / Expires:</b> ${escapeHtml(quote.expiry_date ?? "-")}</p>
        <p><b>المرحلة / Stage:</b> ${escapeHtml(stage?.name ?? "")}</p>
        <p><b>الوصف / Notes:</b><br/>${escapeHtml(quote.notes ?? "-")}</p>
        <p>يرجى الدخول للتطبيق للموافقة أو الرفض.<br/>Please log in to the app to approve or reject.</p>
      </div>
    `.trim();

    // Build MIME
    const boundaryMixed = `mixed_${Math.random().toString(36).slice(2)}`;
    const parts: string[] = [];
    parts.push(`From: ${encodeHeader(fromName)} <${fromEmail}>`);
    parts.push(`To: ${recipients.join(", ")}`);
    parts.push(`Subject: ${encodeHeader(subject)}`);
    parts.push(`MIME-Version: 1.0`);
    parts.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`);
    parts.push("");
    parts.push(`--${boundaryMixed}`);
    parts.push(`Content-Type: text/html; charset="UTF-8"`);
    parts.push(`Content-Transfer-Encoding: base64`);
    parts.push("");
    parts.push(b64Encode(new TextEncoder().encode(bodyHtml)));
    for (const at of attachmentParts) {
      parts.push(`--${boundaryMixed}`);
      parts.push(`Content-Type: ${at.contentType}; name="${at.filename}"`);
      parts.push(`Content-Disposition: attachment; filename="${at.filename}"`);
      parts.push(`Content-Transfer-Encoding: base64`);
      parts.push("");
      // Wrap base64 at 76 chars
      parts.push(at.b64.replace(/(.{76})/g, "$1\r\n"));
    }
    parts.push(`--${boundaryMixed}--`);
    const rawMime = parts.join("\r\n");
    const raw = b64urlEncode(new TextEncoder().encode(rawMime));

    // Send via Gmail gateway
    const gwUrl = "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send";
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !gmailKey) throw new Error("Gmail connector not configured");

    const res = await fetch(gwUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
      },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error("Gmail send failed", res.status, errBody);
      throw new Error(`Gmail send failed [${res.status}]: ${errBody}`);
    }

    await supabase.from("quote_email_log").insert({
      quote_id: quote.id,
      stage_id: stageId,
      sender_id: userId,
      recipients,
      subject,
    });

    return { sent: true, recipients };
  });

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

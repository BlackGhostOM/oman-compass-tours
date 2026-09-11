"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { FileLock2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { countries, countryName } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Traveller = {
  _id: Id<"travellers">;
  firstName: string;
  lastName: string;
  relationship: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  dietary: string | null;
  hasDocument: boolean;
};

const empty = { firstName: "", lastName: "", relationship: "", dateOfBirth: "", nationality: "", passportNumber: "", passportExpiry: "", dietary: "" };

export default function TravellersPage() {
  const locale = useLocale();
  const t = useTranslations("account.travellers");
  const rows = useQuery(api.account.travellers);
  const upsert = useMutation(api.account.upsertTraveller);
  const remove = useMutation(api.account.removeTraveller);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Id<"travellers"> | null>(null);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(tr?: Traveller) {
    setEditing(tr?._id ?? null);
    setForm(tr ? { firstName: tr.firstName, lastName: tr.lastName, relationship: tr.relationship ?? "", dateOfBirth: tr.dateOfBirth ?? "", nationality: tr.nationality ?? "", passportNumber: "", passportExpiry: tr.passportExpiry ?? "", dietary: tr.dietary ?? "" } : empty);
    setFile(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let documentStorageId: Id<"_storage"> | undefined;
      if (file) {
        if (file.size > 8 * 1024 * 1024) throw new Error("too_large");
        const url = await generateUploadUrl({ purpose: "document" });
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const json = (await res.json()) as { storageId: Id<"_storage"> };
        documentStorageId = json.storageId;
      }
      await upsert({
        id: editing ?? undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        relationship: form.relationship || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        nationality: form.nationality || undefined,
        passportNumber: form.passportNumber || undefined,
        passportExpiry: form.passportExpiry || undefined,
        dietary: form.dietary || undefined,
        documentStorageId,
      });
      toast.success(t("saved"));
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message === "too_large" ? t("tooLarge") : t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (rows === undefined) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => startEdit()} className="bg-gold-gradient text-navy-950"><Plus className="size-4" /> {t("add")}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="tr-first">{t("firstName")}</Label><Input id="tr-first" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-last">{t("lastName")}</Label><Input id="tr-last" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-rel">{t("relationship")}</Label><Input id="tr-rel" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder={t("relationshipPlaceholder")} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-dob">{t("dob")}</Label><Input id="tr-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>{t("nationality")}</Label>
                  <Select value={form.nationality || "none"} onValueChange={(v) => setForm({ ...form, nationality: v === "none" ? "" : v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72"><SelectItem value="none">—</SelectItem>{countries.map((c) => <SelectItem key={c.code} value={c.code}>{locale === "ar" ? c.ar : c.en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="tr-diet">{t("dietary")}</Label><Input id="tr-diet" value={form.dietary} onChange={(e) => setForm({ ...form, dietary: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-pass">{t("passport")}</Label><Input id="tr-pass" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} placeholder={editing ? t("passportKeep") : ""} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-exp">{t("passportExpiry")}</Label><Input id="tr-exp" type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tr-doc">{t("document")}</Label>
                <Input id="tr-doc" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileLock2 className="size-3.5" /> {t("documentHint")}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button type="submit" disabled={busy} className="bg-gold-gradient text-navy-950"><Upload className="size-4" /> {busy ? t("saving") : t("save")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.map((tr) => (
            <li key={tr._id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-base text-foreground">{tr.firstName} {tr.lastName}</h3>
                  <p className="text-sm text-muted-foreground">{[tr.relationship, tr.nationality ? countryName(tr.nationality, locale) : null, tr.dateOfBirth].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={t("edit")} onClick={() => startEdit(tr)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={t("delete")} className="text-danger" onClick={async () => { await remove({ id: tr._id }); toast.success(t("deleted")); }}><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                {tr.passportNumber && <div>{t("passport")}: <span dir="ltr">{tr.passportNumber}</span>{tr.passportExpiry ? ` · ${tr.passportExpiry}` : ""}</div>}
                {tr.dietary && <div>{t("dietary")}: {tr.dietary}</div>}
                <div className="flex items-center gap-1.5"><FileLock2 className="size-3.5" /> {tr.hasDocument ? t("documentStored") : t("noDocument")}</div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

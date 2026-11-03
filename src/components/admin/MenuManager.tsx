"use client";

import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { filterAdminMenuItems } from "@/lib/admin-menu";
import { formatRupiah } from "@/lib/pricing";
import type { AdminMenuData, AdminMenuItemView } from "@/lib/services/admin-menu";
import { cn } from "@/lib/utils";

/**
 * Manajemen menu admin: daftar, pencarian/filter, toggle 86'd,
 * tambah/ubah menu, dan tambah kategori.
 */

type Station = "KITCHEN" | "BAR" | "PASTRY";

interface MenuFormState {
  name: string;
  categoryId: string;
  basePrice: string;
  costPrice: string;
  station: Station;
  description: string;
  tags: string;
  prepTimeMinutes: string;
  availableFrom: string;
  availableUntil: string;
}

function emptyForm(categoryId: string): MenuFormState {
  return {
    name: "",
    categoryId,
    basePrice: "",
    costPrice: "",
    station: "KITCHEN",
    description: "",
    tags: "",
    prepTimeMinutes: "10",
    availableFrom: "",
    availableUntil: "",
  };
}

function digits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

export function MenuManager({ initialData }: { initialData: AdminMenuData }) {
  const [data, setData] = useState<AdminMenuData>(initialData);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [only86, setOnly86] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminMenuItemView | null>(null);
  const [form, setForm] = useState<MenuFormState>(emptyForm(""));
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/menu", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { data?: AdminMenuData } | null;

    if (payload?.data) {
      setData(payload.data);
    }
  }, []);

  const visibleItems = useMemo(
    () =>
      filterAdminMenuItems(data.items, {
        search,
        categoryId: categoryFilter.length > 0 ? categoryFilter : null,
        only86,
      }),
    [data.items, search, categoryFilter, only86],
  );

  async function request(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(url, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? "Aksi gagal diproses.");
        return false;
      }

      await refresh();
      return true;
    } catch {
      setError("Tidak dapat menghubungi server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(item: AdminMenuItemView) {
    // Optimistic update dengan revert bila gagal.
    const next = !item.isAvailable;
    setData((previous) => ({
      ...previous,
      items: previous.items.map((entry) =>
        entry.id === item.id ? { ...entry, isAvailable: next } : entry,
      ),
      stats: {
        ...previous.stats,
        unavailable: previous.stats.unavailable + (next ? -1 : 1),
      },
    }));

    const ok = await request(
      `/api/admin/menu-items/${encodeURIComponent(item.id)}/availability`,
      "PATCH",
      { isAvailable: next },
    );

    if (!ok) {
      setData((previous) => ({
        ...previous,
        items: previous.items.map((entry) =>
          entry.id === item.id ? { ...entry, isAvailable: item.isAvailable } : entry,
        ),
        stats: { ...previous.stats, unavailable: previous.stats.unavailable + (next ? 1 : -1) },
      }));
      return;
    }

    setMessage(`${item.name} ${next ? "tersedia kembali" : "ditandai 86'd"}.`);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(data.categories[0]?.id ?? ""));
    setFormOpen(true);
  }

  function openEdit(item: AdminMenuItemView) {
    setEditing(item);
    setForm({
      name: item.name,
      categoryId: item.categoryId,
      basePrice: String(item.basePrice),
      costPrice: String(item.costPrice),
      station: item.station,
      description: item.description ?? "",
      tags: item.tags.join(", "),
      prepTimeMinutes: String(item.prepTimeMinutes),
      availableFrom: item.availableFrom ?? "",
      availableUntil: item.availableUntil ?? "",
    });
    setFormOpen(true);
  }

  async function submitForm() {
    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      basePrice: Number(form.basePrice || "0"),
      costPrice: Number(form.costPrice || "0"),
      station: form.station,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      prepTimeMinutes: Number(form.prepTimeMinutes || "10"),
      ...(form.availableFrom ? { availableFrom: form.availableFrom } : {}),
      ...(form.availableUntil ? { availableUntil: form.availableUntil } : {}),
    };

    const ok = editing
      ? await request(`/api/admin/menu-items/${encodeURIComponent(editing.id)}`, "PATCH", payload)
      : await request("/api/admin/menu-items", "POST", payload);

    if (ok) {
      setFormOpen(false);
      setMessage(editing ? "Menu diperbarui." : "Menu baru ditambahkan.");
    }
  }

  async function removeItem(item: AdminMenuItemView) {
    const ok = await request(`/api/admin/menu-items/${encodeURIComponent(item.id)}`, "DELETE");

    if (ok) {
      setMessage(`${item.name} dinonaktifkan.`);
    }
  }

  async function submitCategory() {
    if (categoryName.trim().length < 2) {
      setError("Nama kategori minimal 2 karakter.");
      return;
    }

    const ok = await request("/api/admin/categories", "POST", { name: categoryName.trim() });

    if (ok) {
      setCategoryOpen(false);
      setCategoryName("");
      setMessage("Kategori ditambahkan.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Back-office
          </span>
          <h1 className="text-lg font-extrabold">Manajemen Menu</h1>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {data.stats.items} menu · {data.stats.unavailable} sedang 86&apos;d ·{" "}
            {data.stats.categories} kategori
          </p>
        </div>

        <div className="flex gap-1.5">
          <Button variant="outline" onClick={() => setCategoryOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Kategori
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Tambah Menu
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex min-h-11 flex-1 items-center gap-1.5 rounded-lg border border-input bg-background px-2">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari menu…"
            aria-label="Cari menu"
            className="h-10 w-full bg-transparent text-xs outline-none"
          />
        </label>

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter kategori"
          className="h-11 rounded-lg border border-input bg-background px-2 text-xs font-semibold outline-none"
        >
          <option value="">Semua kategori</option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-pressed={only86}
          onClick={() => setOnly86((previous) => !previous)}
          className={cn(
            "min-h-11 rounded-lg border px-3 text-xs font-bold transition",
            only86
              ? "border-danger bg-danger/10 text-danger"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          Hanya 86&apos;d
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-2 text-[11px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {message ? (
        <p role="status" className="rounded-lg bg-success/10 p-2 text-[11px] font-semibold text-success">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-bold">Menu</th>
              <th className="px-3 py-2 font-bold">Kategori</th>
              <th className="px-3 py-2 text-right font-bold">Harga</th>
              <th className="px-3 py-2 text-right font-bold">HPP</th>
              <th className="px-3 py-2 font-bold">Stasiun</th>
              <th className="px-3 py-2 font-bold">Tersedia</th>
              <th className="px-3 py-2 text-right font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  Tidak ada menu yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => (
                <tr key={item.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex flex-col">
                      <span className="font-bold">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground">{item.slug}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px]">{item.categoryName}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatRupiah(item.basePrice)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatRupiah(item.costPrice)}
                  </td>
                  <td className="px-3 py-2 text-[11px]">{item.station}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.isAvailable}
                      aria-label={`Ketersediaan ${item.name}`}
                      disabled={busy}
                      onClick={() => void toggleAvailability(item)}
                      className={cn(
                        "relative h-7 w-12 rounded-full border transition disabled:opacity-50",
                        item.isAvailable
                          ? "border-success/50 bg-success/30"
                          : "border-danger/50 bg-danger/30",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-5 rounded-full bg-card shadow transition-all",
                          item.isAvailable ? "left-6" : "left-0.5",
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label={`Ubah ${item.name}`}
                        className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeItem(item)}
                        aria-label={`Nonaktifkan ${item.name}`}
                        className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? `Ubah ${editing.name}` : "Tambah Menu"}
        description="Nominal dalam Rupiah. HPP wajib lebih kecil dari harga jual."
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nama menu" className="col-span-2">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none"
            />
          </Field>

          <Field label="Kategori">
            <select
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none"
            >
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Stasiun">
            <select
              value={form.station}
              onChange={(event) => setForm({ ...form, station: event.target.value as Station })}
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none"
            >
              <option value="KITCHEN">KITCHEN</option>
              <option value="BAR">BAR</option>
              <option value="PASTRY">PASTRY</option>
            </select>
          </Field>

          <Field label="Harga jual">
            <input
              value={form.basePrice}
              onChange={(event) => setForm({ ...form, basePrice: digits(event.target.value) })}
              inputMode="numeric"
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs tabular-nums outline-none"
            />
          </Field>

          <Field label="HPP">
            <input
              value={form.costPrice}
              onChange={(event) => setForm({ ...form, costPrice: digits(event.target.value) })}
              inputMode="numeric"
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs tabular-nums outline-none"
            />
          </Field>

          <Field label="Deskripsi" className="col-span-2">
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={280}
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none"
            />
          </Field>

          <Field label="Tag (pisahkan koma)" className="col-span-2">
            <input
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none"
            />
          </Field>

          <Field label="Waktu masak (menit)">
            <input
              value={form.prepTimeMinutes}
              onChange={(event) =>
                setForm({ ...form, prepTimeMinutes: digits(event.target.value) })
              }
              inputMode="numeric"
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs tabular-nums outline-none"
            />
          </Field>

          <Field label="Jadwal mulai">
            <input
              type="time"
              value={form.availableFrom}
              onChange={(event) => setForm({ ...form, availableFrom: event.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none"
            />
          </Field>

          <Field label="Jadwal selesai">
            <input
              type="time"
              value={form.availableUntil}
              onChange={(event) => setForm({ ...form, availableUntil: event.target.value })}
              className="h-11 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none"
            />
          </Field>
        </div>

        <Button className="mt-3 w-full" disabled={busy} onClick={() => void submitForm()}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {editing ? "Simpan Perubahan" : "Simpan Menu"}
        </Button>
      </Modal>

      <Modal
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title="Tambah Kategori"
        description="Kategori baru langsung muncul di urutan terakhir."
      >
        <div className="flex flex-col gap-2">
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="Nama kategori"
            maxLength={60}
            className="h-11 rounded-lg border border-input bg-background px-2 text-xs outline-none"
          />
          <Button disabled={busy} onClick={() => void submitCategory()}>
            Simpan Kategori
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

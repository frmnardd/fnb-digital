"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  calculateSelectionTotal,
  createInitialSelection,
  isOptionDisabled,
  selectionToModifiers,
  toggleOption,
  validateSelection,
  type ModifierSelection,
} from "@/lib/modifier-selection";
import { formatRupiah, type PricingModifierInput } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PublicMenuItem, PublicModifierGroup } from "@/types/menu";

/**
 * Bottom sheet kustomisasi menu (Level Pedas, Ukuran, Topping, Level Gula).
 *
 * Catatan implementasi: `BottomSheet` tidak merender children saat tertutup,
 * sehingga state form otomatis segar setiap kali sheet dibuka.
 */

const MAX_QUANTITY = 20;

export interface ModifierConfirmPayload {
  item: PublicMenuItem;
  quantity: number;
  modifiers: PricingModifierInput[];
  note: string;
  unitPrice: number;
  total: number;
}

export interface ModifierSheetProps {
  item: PublicMenuItem | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: ModifierConfirmPayload) => void;
}

export function ModifierSheet({ item, onOpenChange, onConfirm }: ModifierSheetProps) {
  return (
    <BottomSheet
      open={item !== null}
      onOpenChange={onOpenChange}
      title={item ? item.name : "Kustomisasi menu"}
      description={item ? `Harga dasar ${formatRupiah(item.basePrice)}` : undefined}
    >
      {item ? (
        <ModifierForm item={item} onClose={() => onOpenChange(false)} onConfirm={onConfirm} />
      ) : null}
    </BottomSheet>
  );
}

function ModifierForm({
  item,
  onConfirm,
  onClose,
}: {
  item: PublicMenuItem;
  onConfirm: (payload: ModifierConfirmPayload) => void;
  onClose: () => void;
}) {
  const groups = item.modifierGroups;

  const [selection, setSelection] = useState<ModifierSelection>(() =>
    createInitialSelection(groups),
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const validation = useMemo(() => validateSelection(groups, selection), [groups, selection]);
  const totals = useMemo(
    () => calculateSelectionTotal(item.basePrice, groups, selection, quantity),
    [item.basePrice, groups, selection, quantity],
  );

  function handleConfirm() {
    if (!validation.valid) {
      setShowErrors(true);
      return;
    }

    onConfirm({
      item,
      quantity,
      modifiers: selectionToModifiers(groups, selection),
      note: note.trim(),
      unitPrice: totals.unitPrice,
      total: totals.total,
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.length === 0 ? (
        <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
          Menu ini tidak memiliki opsi tambahan. Anda tetap dapat mengatur jumlah porsi.
        </p>
      ) : null}

      {groups.map((group) => (
        <ModifierGroupField
          key={group.id}
          group={group}
          selection={selection}
          error={showErrors ? validation.errors.find((item) => item.groupId === group.id) : undefined}
          onToggle={(optionId) =>
            setSelection((previous) => toggleOption(previous, group, optionId))
          }
        />
      ))}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold">Catatan khusus (opsional)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={160}
          rows={2}
          placeholder="Contoh: tanpa bawang, sambal dipisah"
          className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="self-end text-[10px] tabular-nums text-muted-foreground">
          {note.length}/160
        </span>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-secondary/70 p-2">
        <span className="pl-1 text-xs font-bold">Jumlah porsi</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Kurangi jumlah"
            disabled={quantity <= 1}
            onClick={() => setQuantity((previous) => Math.max(1, previous - 1))}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <span className="w-8 text-center text-base font-extrabold tabular-nums">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Tambah jumlah"
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => setQuantity((previous) => Math.min(MAX_QUANTITY, previous + 1))}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-3 border-t bg-card px-4 pb-3 pt-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-base font-extrabold tabular-nums">
            {formatRupiah(totals.total)}
          </span>
          {quantity > 1 ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {formatRupiah(totals.unitPrice)} / porsi
            </span>
          ) : null}
        </div>

        <Button onClick={handleConfirm} className="ml-auto flex-1">
          Tambah ke Keranjang
        </Button>
      </div>
    </div>
  );
}

function ModifierGroupField({
  group,
  selection,
  error,
  onToggle,
}: {
  group: PublicModifierGroup;
  selection: ModifierSelection;
  error?: { message: string };
  onToggle: (optionId: string) => void;
}) {
  const selectedIds = selection[group.id] ?? [];

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="flex w-full items-center gap-1.5 text-xs font-bold">
        <span>{group.name}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide",
            group.isRequired ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
          )}
        >
          {group.isRequired ? "Wajib" : "Opsional"}
        </span>
        <span className="text-[9px] font-semibold text-muted-foreground">
          {group.selectionType === "SINGLE" ? "Pilih 1" : `Maks ${group.maxSelect}`}
        </span>
      </legend>

      <div
        role={group.selectionType === "SINGLE" ? "radiogroup" : "group"}
        aria-label={group.name}
        className="flex flex-col gap-1"
      >
        {group.options.map((option) => {
          const isChecked = selectedIds.includes(option.id);
          const isDisabled = isOptionDisabled(group, selection, option.id);

          const deltaLabel =
            option.priceDelta === 0
              ? "Gratis"
              : option.priceDelta > 0
                ? `+${formatRupiah(option.priceDelta)}`
                : `-${formatRupiah(Math.abs(option.priceDelta))}`;

          return (
            <button
              key={option.id}
              type="button"
              role={group.selectionType === "SINGLE" ? "radio" : "checkbox"}
              aria-checked={isChecked}
              disabled={isDisabled}
              onClick={() => onToggle(option.id)}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition",
                isChecked ? "border-primary bg-primary/5" : "border-border bg-card",
                isDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    isChecked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {isChecked ? <Check className="size-3" /> : null}
                </span>
                <span className="text-sm font-semibold">{option.name}</span>
              </span>

              <span
                className={cn(
                  "shrink-0 text-[11px] font-bold tabular-nums",
                  option.priceDelta > 0 ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {deltaLabel}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-danger">
          {error.message}
        </p>
      ) : null}
    </fieldset>
  );
}

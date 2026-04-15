"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical, ImageOff, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  propertyId: number;
  images: string[];
  /** When false, only show thumbnails (e.g. queue preview). */
  editable?: boolean;
  onUpdated?: (next: string[]) => void;
  compact?: boolean;
};

export function PropertyImagesAdmin({
  propertyId,
  images,
  editable = true,
  onUpdated,
  compact = false,
}: Props) {
  const [localImages, setLocalImages] = useState<string[]>(() => [...images]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setLocalImages((prev) => {
      if (prev.length === images.length && prev.every((v, i) => v === images[i])) return prev;
      return [...images];
    });
  }, [propertyId, images]);

  useEffect(() => {
    setFailedUrls((prev) => {
      const next = new Set<string>();
      for (const u of prev) if (localImages.includes(u)) next.add(u);
      return next;
    });
  }, [localImages]);

  const persist = useCallback(
    async (next: string[]) => {
      setBusy(true);
      setError(null);
      try {
        const { error: upErr } = await supabase.from("properties").update({ images: next }).eq("id", propertyId);
        if (upErr) {
          setError(upErr.message);
          return;
        }
        setLocalImages(next);
        onUpdated?.(next);
      } finally {
        setBusy(false);
      }
    },
    [propertyId, onUpdated],
  );

  const removeAt = async (index: number) => {
    if (!editable || busy) return;
    const next = localImages.filter((_, i) => i !== index);
    await persist(next);
  };

  const moveToIndex = async (from: number, to: number) => {
    if (!editable || busy || from === to || from < 0 || from >= localImages.length || to < 0 || to >= localImages.length)
      return;
    const next = [...localImages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    await persist(next);
  };

  const setAsCover = (index: number) => {
    if (!editable || busy || index === 0) return;
    void moveToIndex(index, 0);
  };

  const markFailed = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  if (!localImages?.length) {
    return <p className="text-xs text-slate-500">لا توجد صور</p>;
  }

  const gridClass = compact
    ? "grid grid-cols-3 gap-2 sm:grid-cols-4"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4";

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs font-bold text-rose-400">{error}</p> : null}
      {busy ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          جاري حفظ الصور…
        </div>
      ) : null}
      <div className={gridClass}>
        {localImages.map((src, index) => {
          const broken = failedUrls.has(src);
          const dragEnabled = editable && !busy && !broken;
          return (
            <div
              key={`${propertyId}-${index}-${src.slice(0, 64)}`}
              className="group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
            >
              <div
                className={`relative aspect-[4/3] w-full ${dragEnabled ? "cursor-grab active:cursor-grabbing" : ""}`}
                draggable={dragEnabled}
                onDragStart={(e) => {
                  if (!dragEnabled) return;
                  e.dataTransfer.setData("text/plain", String(index));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!dragEnabled) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  if (!dragEnabled) return;
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (!Number.isInteger(from) || from < 0 || from >= localImages.length) return;
                  void moveToIndex(from, index);
                }}
              >
                {broken ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-800 px-2 text-center">
                    <ImageOff className="size-8 text-slate-500" aria-hidden />
                    <span className="text-[10px] font-bold text-slate-400">خطأ في التحميل</span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={src}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    loading="lazy"
                    onError={() => markFailed(src)}
                  />
                )}
                {index === 0 && !broken ? (
                  <span className="absolute start-1 top-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-black text-white">
                    غلاف
                  </span>
                ) : null}
                {dragEnabled && !broken ? (
                  <span
                    className="absolute end-1 top-1 rounded bg-slate-950/80 p-0.5 text-slate-400"
                    title="اسحب لإعادة الترتيب"
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </span>
                ) : null}
              </div>
              {editable ? (
                broken ? (
                  <div className="border-t border-slate-800 bg-slate-950/90 p-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      title="حذف الرابط المعطوب"
                      onClick={() => void removeAt(index)}
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-rose-900/60 py-1.5 text-[10px] font-black text-rose-100 hover:bg-rose-800"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      حذف الرابط
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1 border-t border-slate-800 bg-slate-950/90 p-1.5">
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      title="تعيين كصورة الغلاف (أول صورة في المصفوفة)"
                      onClick={() => setAsCover(index)}
                      className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 disabled:opacity-30"
                    >
                      غلاف
                    </button>
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      title="أقرب للبداية"
                      onClick={() => void moveToIndex(index, index - 1)}
                      className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || index >= localImages.length - 1}
                      title="أبعد عن البداية"
                      onClick={() => void moveToIndex(index, index + 1)}
                      className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      title="حذف الصورة"
                      onClick={() => void removeAt(index)}
                      className="ms-auto rounded-lg bg-rose-900/60 p-1 text-rose-100 hover:bg-rose-800"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cropImageWithTransformToDataURL } from "@/lib/avatar";

type Props = {
  file: File | null;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
};

const PREVIEW = 256;

export function AvatarCropper({ file, onCancel, onSave }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [offX, setOffX] = useState(0.5);
  const [offY, setOffY] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const drag = useRef<{ startX: number; startY: number; offX: number; offY: number } | null>(null);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSrc("");
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffX(0.5);
    setOffY(0.5);
    setErr(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, startY: e.clientY, offX, offY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.startX) / PREVIEW;
    const dy = (e.clientY - drag.current.startY) / PREVIEW;
    setOffX(Math.max(0, Math.min(1, drag.current.offX - dx)));
    setOffY(Math.max(0, Math.min(1, drag.current.offY - dy)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const save = useCallback(async () => {
    if (!imgRef.current) return;
    setBusy(true);
    setErr(null);
    try {
      const dataUrl = await cropImageWithTransformToDataURL(imgRef.current, zoom, offX, offY);
      onSave(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't crop image");
    } finally {
      setBusy(false);
    }
  }, [zoom, offX, offY, onSave]);

  if (!file || !src) return null;

  // CSS transform replicates the canvas crop preview
  const naturalScale = zoom;
  const tx = (0.5 - offX) * (1 - 1 / zoom) * 100;
  const ty = (0.5 - offY) * (1 - 1 / zoom) * 100;

  return (
    <div className="space-y-3">
      <div
        className="relative mx-auto select-none overflow-hidden rounded-full ring-1 ring-foreground/10"
        style={{ width: PREVIEW, height: PREVIEW }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: `scale(${naturalScale}) translate(${tx}%, ${ty}%)`, transformOrigin: "center" }}
          crossOrigin="anonymous"
        />
      </div>

      <label className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="w-10">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
      </label>

      {err && <p className="text-xs text-destructive">{err}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Drag to reposition. Stored locally on this device only.
      </p>
    </div>
  );
}

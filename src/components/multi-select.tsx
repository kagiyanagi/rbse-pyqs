"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Option = { value: string; label?: string };

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Any",
  label,
  searchable = true,
  className,
}: {
  options: Array<Option | string>;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label: string;
  searchable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !searchable) return;
    const fine = typeof window !== "undefined"
      && window.matchMedia?.("(pointer: fine)").matches;
    if (fine) searchRef.current?.focus();
  }, [open, searchable]);

  const normalized: Option[] = useMemo(
    () => options.map((o) => (typeof o === "string" ? { value: o } : o)),
    [options],
  );
  const filtered = useMemo(() => {
    if (!query) return normalized;
    const q = query.toLowerCase();
    return normalized.filter((o) => (o.label ?? o.value).toLowerCase().includes(q));
  }, [normalized, query]);

  const selected = new Set(value);

  const toggle = (v: string) => {
    if (selected.has(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const display = value.length === 0 ? placeholder : `${value.length} selected`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between font-normal"
          >
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
              {display}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-2">
            {searchable && (
              <Input
                ref={searchRef}
                placeholder={`Search ${label.toLowerCase()}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8"
              />
            )}
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain px-1 pb-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.has(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                      isSelected && "bg-accent/40",
                    )}
                  >
                    <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{opt.label ?? opt.value}</span>
                  </button>
                );
              })
            )}
          </div>
          {value.length > 0 && (
            <div className="flex justify-between border-t p-2">
              <Button variant="ghost" size="sm" onClick={() => onChange([])}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              <span className="truncate max-w-[14ch]">{v}</span>
              <button
                onClick={() => toggle(v)}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

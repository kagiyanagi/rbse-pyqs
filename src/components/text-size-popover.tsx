"use client";

import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useTextSize } from "@/hooks/use-text-size";

export function TextSizePopover() {
  const { size, set } = useTextSize();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="default"
          className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
          aria-label="Adjust text size"
        >
          <Type className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-72">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex justify-between text-xs">
              <span>Question text</span>
              <span className="tabular-nums text-muted-foreground">{size.question}%</span>
            </div>
            <Slider
              min={80}
              max={180}
              step={5}
              value={[size.question]}
              onValueChange={([v]) => set({ ...size, question: v })}
            />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs">
              <span>Interface</span>
              <span className="tabular-nums text-muted-foreground">{size.ui}%</span>
            </div>
            <Slider
              min={80}
              max={140}
              step={5}
              value={[size.ui]}
              onValueChange={([v]) => set({ ...size, ui: v })}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => set({ question: 100, ui: 100 })}>
            Reset to 100%
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

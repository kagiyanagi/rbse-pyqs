"use client";

import { useTheme } from "next-themes";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PROMPT_TEMPLATE,
  GEMINI_MODELS,
  useGeminiKey,
  useGeminiModel,
  useHideAnswered,
  usePromptTemplate,
  type GeminiModelId,
} from "@/hooks/use-settings";
import { useDefaultLanguage, type LanguageMode } from "@/hooks/use-language";
import { useSolutionCache } from "@/hooks/use-solutions";
import { useToast } from "@/components/ui/toaster";

export function SettingsModal() {
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useDefaultLanguage();
  const [hideAnswered, setHideAnswered] = useHideAnswered();
  const [apiKey, setApiKey] = useGeminiKey();
  const [model, setModel] = useGeminiModel();
  const [template, setTemplate] = usePromptTemplate();
  const { count: solutionCount, clear: clearSolutions } = useSolutionCache();
  const toast = useToast();

  const resetAll = () => {
    if (!confirm("Reset all settings, bookmarks, and answered status?")) return;
    [
      "theme",
      "defaultLanguage",
      "geminiKey",
      "geminiModel",
      "promptTemplate",
      "hideAnswered",
      "rbse_text_size",
      "rbse_bookmarks",
      "rbse_bookmark_notes",
      "rbse_answered",
      "rbse_language_overrides",
      "rbse_solutions",
      "rbse_pfp",
      "rbse_profile_name",
    ].forEach((k) => localStorage.removeItem(k));
    location.reload();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Saved locally in your browser. Your Gemini key never leaves this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select value={theme ?? "dark"} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Default question language</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as LanguageMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English only</SelectItem>
                <SelectItem value="hindi">हिंदी only</SelectItem>
                <SelectItem value="both">Both (EN + हि)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="cursor-pointer">Hide answered questions</Label>
              <p className="text-xs text-muted-foreground">
                Removes questions marked answered from the main list.
              </p>
            </div>
            <Switch checked={hideAnswered} onCheckedChange={setHideAnswered} />
          </div>

          <div className="space-y-1.5">
            <Label>Gemini API key</Label>
            <Input
              type="password"
              placeholder="AIzaSy…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Get a free key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                aistudio.google.com/apikey
              </a>
              . Stored in localStorage only.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>AI model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as GeminiModelId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {GEMINI_MODELS.find((m) => m.id === model)?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>AI prompt template</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTemplate(DEFAULT_PROMPT_TEMPLATE)}
              >
                Reset
              </Button>
            </div>
            <Textarea
              rows={8}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Placeholders: {"{question} {marks} {subject} {chapter} {topic} {marks_guidance} {language}"}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Saved solutions</Label>
              <p className="text-xs text-muted-foreground">
                {solutionCount} cached locally · served instantly without hitting the API.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={solutionCount === 0}
              onClick={() => {
                if (confirm(`Clear all ${solutionCount} saved solutions?`)) {
                  clearSolutions();
                  toast.info(`Cleared ${solutionCount} saved solutions`);
                }
              }}
            >
              Clear
            </Button>
          </div>

          <div className="border-t pt-4">
            <Button variant="destructive" size="sm" onClick={resetAll}>
              Reset everything
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

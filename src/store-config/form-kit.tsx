import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SectionFormProps {
  title: string;
  description?: string;
  disabled?: boolean;
  dirty: boolean;
  saving: boolean;
  onSubmit: () => void;
  onReset: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SectionForm({
  title,
  description,
  disabled,
  dirty,
  saving,
  onSubmit,
  onReset,
  children,
  footer,
}: SectionFormProps) {
  useUnsavedChangesWarning(dirty);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || saving || disabled) return;
        onSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-5">
          {disabled ? (
            <Alert>
              <AlertDescription>
                Seu papel permite apenas visualizar esta seção.
              </AlertDescription>
            </Alert>
          ) : null}
          <fieldset disabled={disabled || saving} className="space-y-5">
            {children}
          </fieldset>
          {footer}
          {!disabled ? (
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="min-h-13"
                onClick={onReset}
                disabled={!dirty || saving}
              >
                Descartar alterações
              </Button>
              <Button type="submit" className="min-h-13" disabled={!dirty || saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </form>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  maxLength?: number;
  multiline?: boolean;
}) {
  const describedBy = props.error
    ? `${props.id}-error`
    : props.hint
      ? `${props.id}-hint`
      : undefined;

  return (
    <Field id={props.id} label={props.label} hint={props.hint} error={props.error}>
      {props.multiline ? (
        <Textarea
          id={props.id}
          value={props.value}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          aria-describedby={describedBy}
          aria-invalid={Boolean(props.error)}
          className="text-base"
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <Input
          id={props.id}
          value={props.value}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          inputMode={props.inputMode}
          aria-describedby={describedBy}
          aria-invalid={Boolean(props.error)}
          className="h-12 text-base"
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/** Avisa antes de perder alterações não salvas ao fechar ou recarregar a aba. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/** Estado de formulário com detecção de alterações não salvas. */
export function useSectionForm<T extends object>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);

  useEffect(() => {
    setValue(initial);
    setBaseline(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initial)]);

  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(baseline), [value, baseline]);

  return {
    value,
    dirty,
    set: <K extends keyof T>(key: K, next: T[K]) =>
      setValue((current) => ({ ...current, [key]: next })),
    reset: () => setValue(baseline),
    replace: setValue,
  };
}

export function formatCurrencyInput(value: number | null | undefined): string {
  if (value == null) return "";
  return Number(value).toFixed(2).replace(".", ",");
}

export function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (cleaned.trim() === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

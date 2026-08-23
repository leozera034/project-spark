import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { replaceStoreHours } from "@/store-config/api";
import { SectionForm } from "@/store-config/form-kit";
import { useStoreConfig } from "@/store-config/StoreConfigProvider";
import { WEEKDAY_LABELS } from "@/store-config/types";

export const Route = createFileRoute("/app/loja/configuracoes/horarios")({
  component: HorariosSection,
});

interface Shift {
  opens_at: string;
  closes_at: string;
}
type WeekState = Shift[][];

const EMPTY_WEEK: WeekState = [[], [], [], [], [], [], []];
const DAY_MINUTES = 24 * 60;
const WEEK_MINUTES = 7 * DAY_MINUTES;

function toTime(value: string): string {
  return value.slice(0, 5);
}

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function validateWeek(week: WeekState): Record<number, string> {
  const errors: Record<number, string> = {};
  const intervals: Array<{ weekday: number; start: number; end: number }> = [];

  week.forEach((shifts, weekday) => {
    for (const shift of shifts) {
      if (!shift.opens_at || !shift.closes_at) {
        errors[weekday] = "Preencha abertura e fechamento.";
        continue;
      }
      const startMinute = toMinutes(shift.opens_at);
      const closeMinute = toMinutes(shift.closes_at);
      if (startMinute === closeMinute) {
        errors[weekday] = "A abertura e o fechamento não podem ser iguais.";
        continue;
      }
      const start = weekday * DAY_MINUTES + startMinute;
      const end = weekday * DAY_MINUTES + closeMinute + (closeMinute <= startMinute ? DAY_MINUTES : 0);
      intervals.push({ weekday, start, end });
    }
  });

  const expanded = [
    ...intervals,
    ...intervals.map((item) => ({ ...item, start: item.start + WEEK_MINUTES, end: item.end + WEEK_MINUTES })),
  ].sort((a, b) => a.start - b.start);

  for (let index = 1; index < expanded.length; index += 1) {
    const previous = expanded[index - 1];
    const current = expanded[index];
    if (current.start < previous.end && current.start < WEEK_MINUTES * 2) {
      errors[current.weekday % 7] = "Este turno se sobrepõe a outro horário cadastrado.";
      errors[previous.weekday % 7] = "Este turno se sobrepõe a outro horário cadastrado.";
    }
  }

  return errors;
}

function HorariosSection() {
  const { configuration, storeId, save, isSaving } = useStoreConfig();
  const canEdit = configuration?.can.manage_hours ?? false;
  const settings = configuration?.settings;

  const baseline = useMemo<WeekState>(() => {
    const week: WeekState = EMPTY_WEEK.map(() => []);
    for (const shift of configuration?.hours ?? []) {
      week[shift.weekday]?.push({
        opens_at: toTime(shift.opens_at),
        closes_at: toTime(shift.closes_at),
      });
    }
    return week;
  }, [configuration?.hours]);

  const [week, setWeek] = useState<WeekState>(baseline);
  useEffect(() => setWeek(baseline), [baseline]);

  const dirty = JSON.stringify(week) !== JSON.stringify(baseline);
  const errors = validateWeek(week);
  const hasErrors = Object.keys(errors).length > 0;

  const update = (weekday: number, next: Shift[]) =>
    setWeek((current) => current.map((day, index) => (index === weekday ? next : day)));

  return (
    <SectionForm
      title="Horários de funcionamento"
      description="A loja abre e fecha automaticamente conforme estes turnos. Horários podem atravessar a meia-noite, como 18:00 até 02:00."
      disabled={!canEdit}
      dirty={dirty}
      saving={isSaving}
      onReset={() => setWeek(baseline)}
      onSubmit={() => {
        if (!storeId || !settings || hasErrors) return;
        const payload = week.flatMap((shifts, weekday) =>
          shifts.map((shift) => ({
            weekday,
            opens_at: shift.opens_at,
            closes_at: shift.closes_at,
          })),
        );
        void save(
          () => replaceStoreHours(storeId, payload, settings.updated_at),
          "Horários atualizados.",
        );
      }}
    >
      {settings && !settings.auto_open_by_hours ? (
        <Alert>
          <AlertDescription>
            A abertura automática está desligada em Atendimento. Os horários abaixo aparecem para o
            cliente, mas não abrem nem fecham a loja sozinhos.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        {WEEKDAY_LABELS.map((label, weekday) => {
          const shifts = week[weekday];
          const open = shifts.length > 0;
          return (
            <div key={label} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {open ? "Aberto" : "Fechado"}
                  <Switch
                    checked={open}
                    aria-label={`${label}: ${open ? "aberto" : "fechado"}`}
                    onCheckedChange={(checked) =>
                      update(weekday, checked ? [{ opens_at: "08:00", closes_at: "18:00" }] : [])
                    }
                  />
                </label>
              </div>

              {open ? (
                <div className="mt-3 space-y-2">
                  {shifts.map((shift, index) => {
                    const overnight = Boolean(shift.opens_at && shift.closes_at && toMinutes(shift.closes_at) < toMinutes(shift.opens_at));
                    return (
                      <div key={index}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            aria-label={`${label} — abertura do turno ${index + 1}`}
                            value={shift.opens_at}
                            className="h-12 w-32 text-base"
                            onChange={(event) =>
                              update(
                                weekday,
                                shifts.map((s, i) =>
                                  i === index ? { ...s, opens_at: event.target.value } : s,
                                ),
                              )
                            }
                          />
                          <span className="text-sm text-muted-foreground">até</span>
                          <Input
                            type="time"
                            aria-label={`${label} — fechamento do turno ${index + 1}`}
                            value={shift.closes_at}
                            className="h-12 w-32 text-base"
                            onChange={(event) =>
                              update(
                                weekday,
                                shifts.map((s, i) =>
                                  i === index ? { ...s, closes_at: event.target.value } : s,
                                ),
                              )
                            }
                          />
                          {overnight ? <span className="rounded-full bg-brand-soft px-2 py-1 text-[11px] font-bold text-brand">dia seguinte</span> : null}
                          {shifts.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="min-h-11"
                              onClick={() =>
                                update(
                                  weekday,
                                  shifts.filter((_, i) => i !== index),
                                )
                              }
                            >
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      update(weekday, [...shifts, { opens_at: "18:00", closes_at: "23:00" }])
                    }
                  >
                    Adicionar turno
                  </Button>
                  {errors[weekday] ? (
                    <p role="alert" className="text-xs text-destructive">
                      {errors[weekday]}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionForm>
  );
}
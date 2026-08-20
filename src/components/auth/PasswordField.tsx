import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
  error,
  disabled,
  enterKeyHint,
  autoFocus,
  id: explicitId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  error?: string;
  disabled?: boolean;
  enterKeyHint?: "done" | "next" | "go";
  autoFocus?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const id = explicitId ?? generatedId;
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2.5">
      <Label htmlFor={id} className="text-sm font-bold text-[#2B183B]">
        {label}
      </Label>
      <div className="relative">
        <LockKeyhole
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#55207A]"
          aria-hidden
        />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint ?? "done"}
          aria-invalid={Boolean(error)}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined}
          disabled={disabled}
          autoFocus={autoFocus}
          className="h-14 rounded-2xl border-[#DED7E3] bg-white pl-12 pr-12 text-base text-[#17131C] shadow-none placeholder:text-[#9B929F] focus-visible:border-[#55207A]/45 focus-visible:ring-[#55207A]/12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-1 flex h-14 w-12 items-center justify-center rounded-xl text-[#55207A] transition hover:bg-[#F7F2F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55207A]/25"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

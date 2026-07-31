import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { configurationMessage, type ConfigurationReport } from "../advanced-types";

export function ValidationSummary({ report }: { report: ConfigurationReport | null }) {
  if (!report) return null;

  const errors = report.errors ?? [];
  const warnings = report.warnings ?? [];

  if (report.is_valid && warnings.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Configuração válida</AlertTitle>
        <AlertDescription>
          Este produto pode ser publicado no cardápio com a configuração atual.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Corrija antes de publicar</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {errors.map((code) => (
                <li key={code}>{configurationMessage(code)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {warnings.length > 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Pontos de atenção</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {warnings.map((code) => (
                <li key={code}>{configurationMessage(code)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

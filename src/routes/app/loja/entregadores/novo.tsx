import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateCourier } from "@/store/couriers/hooks/useCouriers";
import { Button } from "@/components/ui/button";
import { Bike, Car, Copy, Check, ShieldAlert, Smartphone, CheckCircle2, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/loja/entregadores/novo")({ component: NewCourierPage });

type NewCourierForm = {
  fullName: string;
  phone: string;
  loginIdentifier: string;
  vehicle: "" | "moto" | "carro";
  canAcceptDeliveries: boolean;
  isActive: boolean;
};

const EMPTY_FORM: NewCourierForm = {
  fullName: "",
  phone: "",
  loginIdentifier: "",
  vehicle: "",
  canAcceptDeliveries: true,
  isActive: true,
};

function NewCourierPage() {
  const createCourier = useCreateCourier();
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState<NewCourierForm>(EMPTY_FORM);
  const [result, setResult] = useState<null | { loginIdentifier: string; temporaryPassword: string | null }>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const vehicle = formData.vehicle;
    if (!vehicle) {
      toast.error("Escolha Moto ou Carro para o entregador.");
      return;
    }
    const idempotencyKey = `create-${crypto.randomUUID()}`;
    try {
      const data = await createCourier.mutateAsync({
        data: {
          fullName: formData.fullName,
          phone: formData.phone,
          loginIdentifier: formData.loginIdentifier,
          vehicle,
          canAcceptDeliveries: formData.canAcceptDeliveries,
          isActive: formData.isActive,
          idempotencyKey,
        },
      });
      setResult({ loginIdentifier: data.loginIdentifier, temporaryPassword: data.temporaryPassword });
    } catch {
      // O hook já apresenta o erro ao usuário.
    }
  };

  const copyPassword = () => {
    if (!result?.temporaryPassword) return;
    navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    toast.success("Senha copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="overflow-hidden border-success/30 shadow-xl">
          <div className="flex items-center gap-3 border-b border-success/20 bg-success-soft px-6 py-4"><CheckCircle2 className="h-5 w-5 text-success" /><h2 className="font-semibold text-success-foreground">Entregador criado com sucesso</h2></div>
          <CardContent className="space-y-6 p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">O acesso está pronto. Por segurança, a senha temporária abaixo será exibida apenas uma vez.</p>
            <div className="space-y-4 rounded-lg bg-muted p-4">
              <div className="space-y-1"><Label className="text-xs uppercase tracking-wider opacity-60">Nome de acesso</Label><div className="select-all font-mono text-lg font-bold">{result.loginIdentifier}</div></div>
              <div className="space-y-1"><Label className="text-xs uppercase tracking-wider opacity-60">Senha temporária</Label><div className="flex items-center gap-2"><div className="flex-1 select-all rounded border border-border bg-background p-2 text-center font-mono text-lg font-bold tracking-wider">{result.temporaryPassword}</div><Button variant="outline" size="icon" onClick={copyPassword} className={cn("transition-colors", copied && "border-success text-success")}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div></div>
            </div>
            <Alert variant="destructive" className="border-warning/30 bg-warning-soft text-warning-foreground"><ShieldAlert className="h-4 w-4 text-warning" /><AlertTitle>Atenção</AlertTitle><AlertDescription className="text-xs opacity-90">O entregador deverá trocar esta senha no primeiro acesso ao aplicativo.</AlertDescription></Alert>
            <div className="flex flex-col gap-3 sm:flex-row"><Button asChild className="flex-1" variant="brand"><Link to="/app/loja/entregadores">Voltar para equipe</Link></Button><Button variant="ghost" className="flex-1" onClick={() => { setResult(null); setFormData(EMPTY_FORM); }}>Cadastrar outro</Button></div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link to="/app/loja/entregadores"><ChevronLeft className="mr-1 h-4 w-4" /> Voltar</Link></Button>
        <h1 className="font-display text-3xl font-black tracking-tight">Novo entregador</h1>
        <p className="mt-1 text-muted-foreground">Crie o acesso e defina como ele poderá participar das entregas.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Dados e veículo</CardTitle><CardDescription>O veículo ajuda a calcular uma estimativa de rota adequada.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2"><Label htmlFor="fullName">Nome completo</Label><Input id="fullName" placeholder="Ex.: Carlos Oliveira" value={formData.fullName} onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))} required /></div>
            <div className="space-y-2"><Label htmlFor="phone">Telefone / WhatsApp</Label><Input id="phone" type="tel" placeholder="(00) 00000-0000" value={formData.phone} onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))} required /></div>
            <div className="space-y-2">
              <Label>Veículo</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" aria-pressed={formData.vehicle === "moto"} onClick={() => setFormData((prev) => ({ ...prev, vehicle: "moto" }))} className={cn("flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition-colors", formData.vehicle === "moto" ? "border-brand bg-brand-soft" : "hover:bg-muted/40")}><Bike className="h-5 w-5" /><span><strong className="block">Moto</strong><small className="text-muted-foreground">Entrega de moto</small></span></button>
                <button type="button" aria-pressed={formData.vehicle === "carro"} onClick={() => setFormData((prev) => ({ ...prev, vehicle: "carro" }))} className={cn("flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left transition-colors", formData.vehicle === "carro" ? "border-brand bg-brand-soft" : "hover:bg-muted/40")}><Car className="h-5 w-5" /><span><strong className="block">Carro</strong><small className="text-muted-foreground">Entrega de carro</small></span></button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-lg">Acesso ao aplicativo</CardTitle></div><CardDescription>Defina o nome que o entregador usará para entrar.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2"><Label htmlFor="loginIdentifier">Nome de acesso</Label><Input id="loginIdentifier" placeholder="Ex.: carlos.aurora" className="font-mono" value={formData.loginIdentifier} onChange={(e) => setFormData((prev) => ({ ...prev, loginIdentifier: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") }))} required /><p className="text-xs text-muted-foreground">Use letras, números, ponto ou sublinhado.</p></div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between gap-4"><div className="space-y-0.5"><Label>Disponível para entregas</Label><p className="text-xs text-muted-foreground">Pode receber novas atribuições.</p></div><Switch checked={formData.canAcceptDeliveries} onCheckedChange={(val) => setFormData((prev) => ({ ...prev, canAcceptDeliveries: val }))} /></div>
              <div className="flex items-center justify-between gap-4"><div className="space-y-0.5"><Label>Conta ativa</Label><p className="text-xs text-muted-foreground">Desative para bloquear o acesso sem apagar o histórico.</p></div><Switch checked={formData.isActive} onCheckedChange={(val) => setFormData((prev) => ({ ...prev, isActive: val }))} /></div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border bg-muted/30 p-4"><Button type="submit" className="w-full" variant="brand" disabled={createCourier.isPending || !formData.vehicle}>{createCourier.isPending ? "Criando acesso..." : "Criar entregador"}</Button></CardFooter>
        </Card>
      </form>
    </main>
  );
}

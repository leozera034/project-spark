import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { useCreateCourier } from "@/store/couriers/hooks/useCouriers";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  UserPlus, 
  Copy, 
  Check, 
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/loja/entregadores/novo")({
  component: NewCourierPage,
});

function NewCourierPage() {
  const navigate = useNavigate();
  const { authContext } = useAuth();
  const storeId = authContext?.store_ids?.[0] ?? null;
  const createCourier = useCreateCourier();
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    loginIdentifier: "",
    canAcceptDeliveries: true,
    isActive: true
  });

  const [result, setResult] = useState<null | {
    loginIdentifier: string;
    temporaryPassword: string | null;
  }>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Gerar idempotency key simples
    const idempotencyKey = `create-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    try {
      const data = await createCourier.mutateAsync({
        data: {
          ...formData,
          idempotencyKey
        }
      });

      
      setResult({
        loginIdentifier: data.loginIdentifier,
        temporaryPassword: data.temporaryPassword
      });
    } catch (err) {
      // O erro já é tratado no hook useCreateCourier com toast
    }
  };

  const copyPassword = () => {
    if (result?.temporaryPassword) {
      navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
      toast.success("Senha copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (result) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="border-teal-200 dark:border-teal-900 shadow-xl overflow-hidden">
          <div className="bg-teal-50 dark:bg-teal-950/30 px-6 py-4 border-b border-teal-100 dark:border-teal-900 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <h2 className="font-semibold text-teal-900 dark:text-teal-100">Entregador Criado com Sucesso</h2>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground leading-relaxed">
                O acesso foi provisionado. Por segurança, a senha temporária abaixo será exibida **apenas uma vez**.
              </p>
              
              <div className="rounded-lg bg-muted p-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wider opacity-60">Identificador de Acesso</Label>
                  <div className="font-mono font-bold text-lg select-all">{result.loginIdentifier}</div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wider opacity-60">Senha Temporária</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono font-bold text-lg bg-background p-2 rounded border border-border select-all tracking-wider text-center">
                      {result.temporaryPassword}
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={copyPassword}
                      className={cn("transition-colors", copied && "text-teal-600 border-teal-600")}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription className="text-xs opacity-90">
                O entregador deverá trocar esta senha no primeiro acesso ao aplicativo.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1" variant="brand">
                <Link to="/app/loja/entregadores">
                  Voltar para lista
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                className="flex-1"
                onClick={() => {
                  setResult(null);
                  setFormData({
                    fullName: "",
                    phone: "",
                    loginIdentifier: "",
                    canAcceptDeliveries: true,
                    isActive: true
                  });
                }}
              >
                Cadastrar outro
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/app/loja/entregadores">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Novo Entregador</h1>
        <p className="text-muted-foreground">Preencha os dados básicos para criar o acesso operacional.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
            <CardDescription>O nome completo é usado na identificação interna.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input 
                id="fullName" 
                placeholder="Ex: Carlos Oliveira" 
                value={formData.fullName}
                onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="(00) 00000-0000" 
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Acesso ao Aplicativo</CardTitle>
            </div>
            <CardDescription>Configure como o entregador fará login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="loginIdentifier">Identificador Único</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="loginIdentifier" 
                  placeholder="Ex: carlos.aurora" 
                  className="font-mono"
                  value={formData.loginIdentifier}
                  onChange={e => setFormData(prev => ({ ...prev, loginIdentifier: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') }))}
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Apenas letras, números, ponto e sublinhado.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Disponível para entregas</Label>
                  <p className="text-xs text-muted-foreground">Pode receber novas atribuições imediatamente.</p>
                </div>
                <Switch 
                  checked={formData.canAcceptDeliveries}
                  onCheckedChange={val => setFormData(prev => ({ ...prev, canAcceptDeliveries: val }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Conta Ativa</Label>
                  <p className="text-xs text-muted-foreground">Desative para bloquear o acesso sem excluir os dados.</p>
                </div>
                <Switch 
                  checked={formData.isActive}
                  onCheckedChange={val => setFormData(prev => ({ ...prev, isActive: val }))}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t border-border p-4">
            <Button type="submit" className="w-full" variant="brand" disabled={createCourier.isPending}>
              {createCourier.isPending ? "Provisionando..." : "Criar Entregador"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}

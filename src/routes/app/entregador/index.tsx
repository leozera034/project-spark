import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Bike, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  History,
  Power,
  ChevronRight,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/kitchen/useKitchenOrders";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/entregador/")({
  component: CourierDashboard,
});

function CourierDashboard() {
  const { authContext, signOut } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();

  // Mock de entregas para visualização imediata (será conectado ao banco na sequência)
  const [activeDelivery] = useState({
    id: "123",
    orderNumber: 1054,
    status: "retirada",
    address: "Rua das Flores, 123 - Centro",
    clientName: "Maria Silva",
    items: 3,
    timeElapsed: 12
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header Compacto Mobile-First */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">{authContext?.full_name}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn("h-2 w-2 rounded-full", online ? "bg-emerald-500" : "bg-slate-300")} />
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                {online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut("local").then(() => navigate({ to: "/entrar/entregador" }))}>
          <Power className="h-5 w-5 text-muted-foreground" />
        </Button>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Status de Disponibilidade */}
        <Card className={cn(
          "border-2 transition-colors",
          online ? "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-slate-200"
        )}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase opacity-60">Sua Disponibilidade</p>
              <p className="font-semibold">{online ? "Recebendo novas entregas" : "Pausado / Offline"}</p>
            </div>
            <Badge variant={online ? "brand" : "secondary"} className="h-8 px-4 text-xs">
              {online ? "DISPONÍVEL" : "INDISPONÍVEL"}
            </Badge>
          </CardContent>
        </Card>

        {/* Entrega Ativa (Destaque) */}
        {activeDelivery && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase opacity-60 flex items-center gap-2">
              <Bike className="h-4 w-4" /> Entrega em Curso
            </h2>
            <Card className="shadow-lg border-brand/20 bg-gradient-to-br from-background to-brand/[0.02]">
              <CardContent className="p-0">
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-2xl font-black text-brand">#{activeDelivery.orderNumber}</p>
                      <Badge variant="outline" className="mt-1 bg-brand/5 border-brand/20 text-brand">
                        AGUARDANDO RETIRADA
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Há quanto tempo</p>
                      <p className="font-bold flex items-center justify-end gap-1 text-emerald-600">
                        <Clock className="h-3 w-3" /> {activeDelivery.timeElapsed} min
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Endereço de Entrega</p>
                        <p className="font-medium text-sm leading-snug">{activeDelivery.address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 border-t">
                  <Button asChild className="w-full h-14 text-lg font-bold shadow-md" variant="brand">
                    <Link to={`/app/entregador/entrega`}>
                      ABRIR PAINEL DE ENTREGA
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Histórico e Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-background">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-black">12</p>
              <p className="text-[10px] font-bold uppercase opacity-60">Hoje</p>
            </CardContent>
          </Card>
          <Card className="bg-background cursor-pointer hover:bg-slate-50 transition-colors">
            <Link to="/preview/entregador/historico">

              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                  <History className="h-5 w-5 text-slate-600" />
                </div>
                <p className="text-xs font-bold uppercase">Ver Histórico</p>
                <p className="text-[10px] font-medium opacity-60">Últimos 30 dias</p>
              </CardContent>
            </Link>
          </Card>

        </div>

        {/* Notificações / Alertas */}
        <AlertCircle className="h-4 w-4 mx-auto text-slate-300" />
      </main>

      {/* Navegação Inferior (Padrão App) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t h-16 flex items-center justify-around px-6 z-20">
        <Link to="/app/entregador" className="flex flex-col items-center gap-1 text-brand">
          <Bike className="h-6 w-6" />
          <span className="text-[10px] font-bold">Início</span>
        </Link>
        <Link to="/preview/entregador/historico" className="flex flex-col items-center gap-1 text-muted-foreground">
          <History className="h-6 w-6" />
          <span className="text-[10px] font-bold">Histórico</span>
        </Link>
        <Link to="/preview/entregador/configuracoes" className="flex flex-col items-center gap-1 text-muted-foreground">
          <User className="h-6 w-6" />
          <span className="text-[10px] font-bold">Perfil</span>
        </Link>
      </nav>
    </div>
  );
}

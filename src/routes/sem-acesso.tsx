import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/auth/auth.routes";
import { useAuth } from "@/auth/useAuth";

export const Route = createFileRoute("/sem-acesso")({
  head: () => ({
    meta: [
      { title: "Acesso indisponível | Pediu Aqui" },
      {
        name: "description",
        content: "Sua conta não tem acesso liberado no momento no Pediu Aqui.",
      },
      { property: "og:title", content: "Acesso indisponível | Pediu Aqui" },
      { property: "og:description", content: "Sua conta não tem acesso liberado no momento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NoAccessPage,
});

function NoAccessPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthShell
      title="Acesso indisponível"
      description="Sua conta existe, mas não há acesso liberado neste momento."
      footer={
        <Link to="/" className="underline underline-offset-4">
          Voltar ao início
        </Link>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Fale com o responsável pela sua loja ou com o suporte para regularizar o acesso.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            void signOut("local").then(() => navigate({ to: AUTH_ROUTES.storeSignIn as never }))
          }
        >
          Sair da conta
        </Button>
      </div>
    </AuthShell>
  );
}

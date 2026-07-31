import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { StickyAction, StorePage, StoreStepHeader } from "@/components/demo/StoreShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/demo/state/useDemo";
import { formatBRL } from "@/demo/utils/format";
import { demoHead } from "@/demo/utils/head";
import type { DemoAddress } from "@/demo/types/demo";

export const Route = createFileRoute("/loja/mercado-aurora/endereco/novo")({
  head: demoHead(
    "Novo endereço — Mercado Aurora",
    "Cadastro de endereço em etapas simples, uma decisão por tela.",
  ),
  component: NewAddress,
});

const TOTAL = 7;

function NewAddress() {
  const navigate = useNavigate();
  const { neighborhoods, updateCustomer } = useDemo();

  const [step, setStep] = useState(1);
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [noNumber, setNoNumber] = useState(false);
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [label, setLabel] = useState<DemoAddress["label"]>("Casa");

  const neighborhood = neighborhoods.find((item) => item.id === neighborhoodId);

  const canAdvance =
    (step === 1 && neighborhoodId !== "") ||
    (step === 2 && street.trim().length > 2) ||
    (step === 3 && (noNumber || number.trim().length > 0)) ||
    step === 4 ||
    step === 5 ||
    step === 6 ||
    step === 7;

  function finish() {
    updateCustomer({
      address: {
        id: "addr-novo",
        label,
        neighborhoodId,
        street: street.trim(),
        number: noNumber ? "s/n" : number.trim(),
        complement: complement.trim() || undefined,
        reference: reference.trim() || undefined,
      },
      addressConfirmed: true,
    });
    void navigate({ to: "/loja/mercado-aurora/cardapio" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <StoreStepHeader
        title="Novo endereço"
        backTo="/loja/mercado-aurora/endereco"
        step={step}
        totalSteps={TOTAL}
      />
      <StorePage className="flex-1">
        {step === 1 ? (
          <fieldset>
            <legend className="text-2xl font-semibold text-foreground">Qual é o seu bairro?</legend>
            <p className="mt-2 text-base text-muted-foreground">
              A taxa e o pedido mínimo mudam conforme o bairro.
            </p>
            <div className="mt-5 space-y-2">
              {neighborhoods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={neighborhoodId === item.id}
                  onClick={() => setNeighborhoodId(item.id)}
                  className={`flex w-full min-h-14 items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                    neighborhoodId === item.id
                      ? "border-brand bg-accent"
                      : "border-border bg-surface hover:bg-muted"
                  }`}
                >
                  <span className="text-base font-medium text-foreground">{item.name}</span>
                  <span className="text-sm text-muted-foreground">
                    Taxa {formatBRL(item.deliveryFee)} · mínimo {formatBRL(item.minimumOrder)}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Qual é a rua ou avenida?</h1>
            <Label htmlFor="rua" className="mt-5 block text-base">
              Rua ou avenida
            </Label>
            <Input
              id="rua"
              className="mt-2 h-12 text-base"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              placeholder="Rua das Acácias"
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Qual é o número?</h1>
            <Label htmlFor="numero" className="mt-5 block text-base">
              Número
            </Label>
            <Input
              id="numero"
              inputMode="numeric"
              className="mt-2 h-12 text-base"
              value={number}
              disabled={noNumber}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="45"
            />
            <div className="mt-4 flex items-center gap-3">
              <Checkbox
                id="sem-numero"
                checked={noNumber}
                onCheckedChange={(checked) => setNoNumber(checked === true)}
              />
              <Label htmlFor="sem-numero" className="text-base">
                Este endereço não tem número
              </Label>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tem complemento?</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Apartamento, bloco, casa dos fundos. Pode deixar em branco.
            </p>
            <Label htmlFor="complemento" className="mt-5 block text-base">
              Complemento
            </Label>
            <Input
              id="complemento"
              className="mt-2 h-12 text-base"
              value={complement}
              onChange={(event) => setComplement(event.target.value)}
              placeholder="Apto 12"
            />
          </div>
        ) : null}

        {step === 5 ? (
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Algum ponto de referência?</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Ajuda o entregador a chegar mais rápido.
            </p>
            <Label htmlFor="referencia" className="mt-5 block text-base">
              Ponto de referência
            </Label>
            <Input
              id="referencia"
              className="mt-2 h-12 text-base"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Portão cinza, ao lado da banca"
            />
          </div>
        ) : null}

        {step === 6 ? (
          <fieldset>
            <legend className="text-2xl font-semibold text-foreground">
              Como quer chamar este endereço?
            </legend>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(["Casa", "Trabalho"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={label === option}
                  onClick={() => setLabel(option)}
                  className={`min-h-14 rounded-xl border px-4 py-3 text-base font-medium transition-colors ${
                    label === option
                      ? "border-brand bg-accent text-foreground"
                      : "border-border bg-surface text-foreground hover:bg-muted"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 7 ? (
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Confira antes de salvar</h1>
            <dl className="mt-5 space-y-2 rounded-2xl border border-border bg-surface p-5 text-base">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Endereço</dt>
                <dd className="text-right font-medium text-foreground">
                  {street}, {noNumber ? "s/n" : number}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Bairro</dt>
                <dd className="text-right text-foreground">{neighborhood?.name}</dd>
              </div>
              {complement ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Complemento</dt>
                  <dd className="text-right text-foreground">{complement}</dd>
                </div>
              ) : null}
              {reference ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Referência</dt>
                  <dd className="text-right text-foreground">{reference}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rótulo</dt>
                <dd className="text-right text-foreground">{label}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="text-muted-foreground">Taxa de entrega</dt>
                <dd className="text-right text-foreground">
                  {formatBRL(neighborhood?.deliveryFee ?? 0)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">
              Sem mapa e sem localização: o endereço é informado por você.
            </p>
          </div>
        ) : null}
      </StorePage>

      <StickyAction>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="touch"
            className="h-13"
            onClick={() => {
              if (step === 1) {
                void navigate({ to: "/loja/mercado-aurora/endereco" });
              } else {
                setStep((current) => current - 1);
              }
            }}
          >
            Voltar
          </Button>
          <Button
            size="touch"
            variant="brand"
            className="h-13 flex-1 text-base"
            disabled={!canAdvance}
            onClick={() => (step === TOTAL ? finish() : setStep((current) => current + 1))}
          >
            {step === TOTAL ? "Salvar e continuar" : "Continuar"}
          </Button>
        </div>
      </StickyAction>
    </div>
  );
}

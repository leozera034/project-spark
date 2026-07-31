/**
 * Máquina de estados explícita do wizard.
 * Nenhuma etapa obrigatória pode ser pulada por manipulação de URL.
 */
import type {
  CustomerLocalProfile,
  CustomerWizardStep,
  FulfillmentType,
  PublicFulfillmentConfiguration,
} from "./customer-wizard.types";

export const ADDRESS_STEPS: CustomerWizardStep[] = [
  "address_neighborhood",
  "address_street",
  "address_number",
  "address_complement",
  "address_reference",
  "address_label",
  "confirm_address",
];

export function isAddressStep(step: CustomerWizardStep): boolean {
  return ADDRESS_STEPS.includes(step);
}

export function addressStepIndex(step: CustomerWizardStep): number {
  return ADDRESS_STEPS.indexOf(step) + 1;
}

/** Primeira etapa da jornada, considerando apenas o que já existe localmente. */
export function initialStep(
  profile: CustomerLocalProfile,
  config: PublicFulfillmentConfiguration | null,
): CustomerWizardStep {
  if (!config) return "loading_store";
  if (!config.deliveryEnabled && !config.pickupEnabled) return "read_only";
  return profile.firstName ? "confirm_saved_name" : "identify_customer";
}

export function stepAfterName(): CustomerWizardStep {
  return "choose_fulfillment";
}

/** Entrega com endereços salvos vai para a escolha; sem endereços, cadastra. */
export function stepAfterFulfillment(
  type: FulfillmentType,
  profile: CustomerLocalProfile,
): CustomerWizardStep {
  if (type === "retirada") return "confirm_pickup";
  return profile.savedAddresses.length > 0 ? "choose_saved_address" : "address_neighborhood";
}

export function nextAddressStep(step: CustomerWizardStep): CustomerWizardStep {
  const index = ADDRESS_STEPS.indexOf(step);
  if (index < 0 || index === ADDRESS_STEPS.length - 1) return "confirm_address";
  return ADDRESS_STEPS[index + 1];
}

export function previousAddressStep(step: CustomerWizardStep): CustomerWizardStep {
  const index = ADDRESS_STEPS.indexOf(step);
  if (index <= 0) return "choose_fulfillment";
  return ADDRESS_STEPS[index - 1];
}

/** Voltar sempre desce uma etapa; nunca reinicia o formulário. */
export function stepBack(
  step: CustomerWizardStep,
  profile: CustomerLocalProfile,
): CustomerWizardStep {
  if (isAddressStep(step)) {
    const previous = previousAddressStep(step);
    if (previous === "choose_fulfillment" && profile.savedAddresses.length > 0) {
      return "choose_saved_address";
    }
    return previous;
  }
  switch (step) {
    case "choose_fulfillment":
      return profile.firstName ? "confirm_saved_name" : "identify_customer";
    case "choose_saved_address":
    case "confirm_pickup":
      return "choose_fulfillment";
    default:
      return step;
  }
}

/** Progresso honesto: caminhos diferentes têm tamanhos diferentes. */
export function progressLabel(step: CustomerWizardStep): string | null {
  if (isAddressStep(step)) {
    return `Endereço — etapa ${addressStepIndex(step)} de ${ADDRESS_STEPS.length}`;
  }
  switch (step) {
    case "identify_customer":
    case "confirm_saved_name":
      return "Etapa 1 de 3";
    case "choose_fulfillment":
      return "Etapa 2 de 3";
    case "choose_saved_address":
    case "confirm_pickup":
      return "Etapa 3 de 3";
    default:
      return null;
  }
}

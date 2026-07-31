/**
 * Normalização de texto do endereço.
 * Serve para comparar duplicidade e para gerar o fingerprint de confirmação.
 */
import type { AddressDraft, FulfillmentType, LocalSavedAddress } from "./customer-wizard.types";

/** Remove caracteres de controle e colapsa espaços. Nunca interpreta HTML. */
export function collapseSpaces(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeForComparison(value: string | null | undefined): string {
  return collapseSpaces(String(value ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Chave canônica de um endereço, usada para detectar duplicidade. */
export function addressIdentityKey(
  address: Pick<
    LocalSavedAddress,
    "neighborhoodId" | "street" | "number" | "hasNoNumber" | "complement"
  >,
): string {
  return [
    address.neighborhoodId,
    normalizeForComparison(address.street),
    address.hasNoNumber ? "s/n" : normalizeForComparison(address.number),
    normalizeForComparison(address.complement),
  ].join("|");
}

/** Hash local, determinístico e não secreto (não é autenticação). */
export function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Fingerprint da confirmação: modalidade + todos os campos do endereço +
 * bairro + versão pública do atendimento. Qualquer mudança invalida.
 */
export function confirmationFingerprint(input: {
  fulfillmentType: FulfillmentType;
  configurationVersion: string;
  address?: LocalSavedAddress | null;
}): string {
  const address = input.address;
  const parts = [
    input.fulfillmentType,
    input.configurationVersion,
    address?.neighborhoodId ?? "",
    normalizeForComparison(address?.street),
    address?.hasNoNumber ? "s/n" : normalizeForComparison(address?.number),
    normalizeForComparison(address?.complement),
    normalizeForComparison(address?.referencePoint),
    normalizeForComparison(address?.customLabel ?? address?.label),
    address?.latitude === null || address?.latitude === undefined ? "" : String(address.latitude),
    address?.longitude === null || address?.longitude === undefined ? "" : String(address.longitude),
  ];
  return stableHash(parts.join("~"));
}

export function emptyDraft(): AddressDraft {
  return {
    editingLocalId: null,
    neighborhoodId: null,
    neighborhoodNameSnapshot: null,
    street: "",
    number: "",
    hasNoNumber: false,
    complement: "",
    referencePoint: "",
    label: "Casa",
    customLabel: "",
    latitude: null,
    longitude: null,
  };
}

export function draftFromAddress(address: LocalSavedAddress): AddressDraft {
  return {
    editingLocalId: address.localId,
    neighborhoodId: address.neighborhoodId,
    neighborhoodNameSnapshot: address.neighborhoodNameSnapshot,
    street: address.street,
    number: address.number ?? "",
    hasNoNumber: address.hasNoNumber,
    complement: address.complement ?? "",
    referencePoint: address.referencePoint ?? "",
    label: address.label,
    customLabel: address.customLabel ?? "",
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

/** Rótulo curto para a barra de contexto do cardápio. */
export function shortAddressLine(address: LocalSavedAddress): string {
  const number = address.hasNoNumber ? "s/n" : (address.number ?? "").trim();
  return collapseSpaces(`${address.street}${number ? `, ${number}` : ""}`);
}

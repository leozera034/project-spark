/** Validação dos dados locais do assistente. Todo conteúdo local é não confiável. */
import { z } from "zod";

import { collapseSpaces } from "./address-normalization";
import type { CustomerLocalProfile, CustomerSessionContext } from "./customer-wizard.types";

const MAX_ADDRESSES = 5;

const plainText = (max: number) =>
  z.string().max(max * 2).transform((value) => collapseSpaces(value))
    .refine((value) => !/[<>]/.test(value), { message: "Use apenas texto simples." })
    .refine((value) => value.length <= max, { message: `Máximo de ${max} caracteres.` });

export const firstNameSchema = plainText(60)
  .refine((value) => value.length >= 2, { message: "Informe pelo menos 2 caracteres." })
  .refine((value) => !/^\d+$/.test(value), { message: "Informe um nome, não apenas números." })
  .refine((value) => /[\p{L}]/u.test(value), { message: "Informe um nome válido." });

export const streetSchema = plainText(120).refine((value) => value.length >= 3, { message: "Informe a rua ou avenida." });
export const numberSchema = plainText(20).refine((value) => value.length >= 1, { message: "Informe o número ou marque “Sem número”." });
export const complementSchema = plainText(100);
export const referenceSchema = plainText(140);
export const customLabelSchema = plainText(30).refine((value) => value.length >= 2, { message: "Informe entre 2 e 30 caracteres." });
export const labelSchema = z.enum(["Casa", "Trabalho", "Outro"]);
const coordinate = z.number().finite().min(-180).max(180).nullable();

export const savedAddressSchema = z.object({
  localId: z.string().uuid(),
  label: labelSchema,
  customLabel: plainText(30).nullable().catch(null),
  neighborhoodId: z.string().uuid().nullable().catch(null),
  neighborhoodNameSnapshot: plainText(120),
  street: plainText(120),
  number: plainText(20).nullable(),
  hasNoNumber: z.boolean(),
  complement: plainText(100).nullable(),
  referencePoint: plainText(140).nullable(),
  latitude: coordinate.catch(null),
  longitude: coordinate.catch(null),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
  lastUsedAt: z.string().max(40).nullable().catch(null),
});

export const profileSchema = z.object({
  schemaVersion: z.literal(1),
  firstName: plainText(60).nullable().catch(null),
  lastFulfillmentPreference: z.enum(["entrega", "retirada"]).nullable().catch(null),
  savedAddresses: z.array(savedAddressSchema).max(MAX_ADDRESSES).catch([]),
  updatedAt: z.string().max(40),
});

export const addressDraftSchema = z.object({
  editingLocalId: z.string().uuid().nullable().catch(null),
  neighborhoodId: z.string().uuid().nullable().catch(null),
  neighborhoodNameSnapshot: plainText(120).nullable().catch(null),
  street: plainText(120).catch(""),
  number: plainText(20).catch(""),
  hasNoNumber: z.boolean().catch(false),
  complement: plainText(100).catch(""),
  referencePoint: plainText(140).catch(""),
  label: labelSchema.catch("Casa"),
  customLabel: plainText(30).catch(""),
  latitude: coordinate.catch(null),
  longitude: coordinate.catch(null),
});

export const wizardStepSchema = z.enum([
  "loading_store","identify_customer","confirm_saved_name","choose_fulfillment","choose_saved_address",
  "address_neighborhood","address_street","address_number","address_complement","address_reference","address_label",
  "confirm_address","confirm_pickup","validating_context","completed","read_only","error",
]);

export const sessionSchema = z.object({
  schemaVersion: z.literal(1),
  wizardStep: wizardStepSchema.catch("identify_customer"),
  firstName: plainText(60).nullable().catch(null),
  fulfillmentType: z.enum(["entrega", "retirada"]).nullable().catch(null),
  selectedAddressLocalId: z.string().uuid().nullable().catch(null),
  addressDraft: addressDraftSchema.nullable().catch(null),
  confirmedAddressFingerprint: z.string().max(64).nullable().catch(null),
  fulfillmentConfigurationVersion: z.string().max(64).nullable().catch(null),
  safeReturnPath: z.string().max(300).nullable().catch(null),
  completed: z.boolean().catch(false),
  updatedAt: z.string().max(40),
});

export const MAX_LOCAL_ADDRESSES = MAX_ADDRESSES;
export function emptyProfile(): CustomerLocalProfile {
  return { schemaVersion:1, firstName:null, lastFulfillmentPreference:null, savedAddresses:[], updatedAt:new Date().toISOString() };
}
export function emptySession(): CustomerSessionContext {
  return { schemaVersion:1, wizardStep:"identify_customer", firstName:null, fulfillmentType:null, selectedAddressLocalId:null, addressDraft:null, confirmedAddressFingerprint:null, fulfillmentConfigurationVersion:null, safeReturnPath:null, completed:false, updatedAt:new Date().toISOString() };
}
export function parseProfile(raw: unknown): CustomerLocalProfile | null {
  const result=profileSchema.safeParse(raw); return result.success ? result.data as CustomerLocalProfile : null;
}
export function parseSession(raw: unknown): CustomerSessionContext | null {
  const result=sessionSchema.safeParse(raw); return result.success ? result.data as CustomerSessionContext : null;
}

/**
 * Estado do wizard do cliente. Um único provider por loja.
 *
 * Regras não negociáveis:
 * - nada de nome/endereço vai para o servidor, URL ou log;
 * - endereço salvo é sugestão, nunca confirmação;
 * - a confirmação vive somente na sessão atual e é invalidada por qualquer
 *   mudança de campo, de bairro, de modalidade ou de versão da loja.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  addressIdentityKey,
  confirmationFingerprint,
  draftFromAddress,
  emptyDraft,
} from "./address-normalization";
import { WIZARD_MESSAGES, messageForValidationError } from "./customer-wizard.errors";
import {
  initialStep,
  stepAfterFulfillment,
  stepAfterName,
  stepBack,
} from "./customer-wizard.machine";
import { sanitizeReturnPath } from "./customer-wizard.routes";
import {
  forgetStore,
  isStorageAvailable,
  readProfile,
  readSession,
  writeProfile,
  writeSession,
} from "./customer-wizard.storage";
import {
  MAX_LOCAL_ADDRESSES,
  emptyProfile,
  emptySession,
  firstNameSchema,
} from "./customer-wizard.validation";
import { getFulfillmentConfiguration, postFulfillmentValidation } from "./fulfillment.api";
import type {
  AddressDraft,
  AddressLabel,
  CustomerLocalProfile,
  CustomerSessionContext,
  CustomerWizardStep,
  FulfillmentType,
  LocalSavedAddress,
  PublicFulfillmentConfiguration,
  StorefrontOrderingContext,
} from "./customer-wizard.types";

type WizardContextValue = {
  slug: string;
  hydrated: boolean;
  storageAvailable: boolean;
  configuration: PublicFulfillmentConfiguration | null;
  configurationError: string | null;
  loadingConfiguration: boolean;
  reloadConfiguration: () => void;

  profile: CustomerLocalProfile;
  session: CustomerSessionContext;
  step: CustomerWizardStep;
  notice: string | null;
  busy: boolean;

  /** Contexto válido apenas quando confirmado nesta sessão. */
  orderingContext: StorefrontOrderingContext | null;
  selectedAddress: LocalSavedAddress | null;
  draft: AddressDraft;
  informative: { fee: number | null; minimum: number | null; minutes: number | null };

  setStep: (step: CustomerWizardStep) => void;
  goBack: () => void;
  submitName: (value: string) => string | null;
  keepSavedName: () => void;
  requestNameChange: () => void;
  chooseFulfillment: (type: FulfillmentType) => void;
  selectSavedAddress: (localId: string) => void;
  startNewAddress: () => void;
  editAddress: (localId: string) => void;
  deleteAddress: (localId: string) => void;
  updateDraft: (patch: Partial<AddressDraft>) => void;
  duplicateOf: (draft: AddressDraft) => LocalSavedAddress | null;
  saveDraftAndReview: () => string | null;
  confirmAddress: () => Promise<void>;
  confirmPickup: () => Promise<void>;
  reopenWizard: () => void;
  forgetLocalData: () => void;
  setReturnPath: (path: string | null) => void;
  restartDraft: () => void;
};

const Ctx = createContext<WizardContextValue | null>(null);

export function useCustomerWizard(): WizardContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCustomerWizard fora do provider");
  return value;
}

export function CustomerWizardProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [profile, setProfile] = useState<CustomerLocalProfile>(() => emptyProfile());
  const [session, setSession] = useState<CustomerSessionContext>(() => emptySession());
  const [configuration, setConfiguration] = useState<PublicFulfillmentConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [loadingConfiguration, setLoadingConfiguration] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [informative, setInformative] = useState<{
    fee: number | null;
    minimum: number | null;
    minutes: number | null;
  }>({ fee: null, minimum: null, minutes: null });
  const [reloadToken, setReloadToken] = useState(0);

  const requestId = useRef(0);

  // Hidratação única por loja. Nunca grava no Storage aqui.
  useEffect(() => {
    const storedProfile = readProfile(slug);
    const storedSession = readSession(slug);
    setProfile(storedProfile);
    setSession(storedSession);
    setStorageAvailable(isStorageAvailable());
    setHydrated(true);
  }, [slug]);

  // Configuração pública de atendimento. Uma requisição por loja/recarga.
  useEffect(() => {
    let cancelled = false;
    const current = ++requestId.current;
    setLoadingConfiguration(true);
    setConfigurationError(null);

    getFulfillmentConfiguration(slug)
      .then((config) => {
        if (cancelled || current !== requestId.current) return;
        setConfiguration(config);
      })
      .catch(() => {
        if (cancelled || current !== requestId.current) return;
        setConfiguration(null);
        setConfigurationError(
          typeof navigator !== "undefined" && navigator.onLine === false
            ? WIZARD_MESSAGES.offlineDraftKept
            : WIZARD_MESSAGES.fulfillmentLoadFailed,
        );
      })
      .finally(() => {
        if (cancelled || current !== requestId.current) return;
        setLoadingConfiguration(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, reloadToken]);

  const persistProfile = useCallback(
    (next: CustomerLocalProfile) => {
      setProfile(next);
      const ok = writeProfile(slug, next);
      if (!ok) setStorageAvailable(false);
    },
    [slug],
  );

  const persistSession = useCallback(
    (patch: Partial<CustomerSessionContext>) => {
      setSession((current) => {
        const next: CustomerSessionContext = {
          ...current,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        const ok = writeSession(slug, next);
        if (!ok) setStorageAvailable(false);
        return next;
      });
    },
    [slug],
  );

  const selectedAddress = useMemo(
    () =>
      profile.savedAddresses.find((item) => item.localId === session.selectedAddressLocalId) ??
      null,
    [profile.savedAddresses, session.selectedAddressLocalId],
  );

  /**
   * O contexto só é válido quando a confirmação desta sessão bate com o
   * fingerprint atual (modalidade + endereço + bairro + versão da loja).
   */
  const orderingContext = useMemo<StorefrontOrderingContext | null>(() => {
    if (!session.completed || !session.fulfillmentType || !configuration) return null;
    if (!session.firstName || !session.confirmedAddressFingerprint) return null;

    const expected = confirmationFingerprint({
      fulfillmentType: session.fulfillmentType,
      configurationVersion: configuration.configurationVersion,
      address: session.fulfillmentType === "entrega" ? selectedAddress : null,
    });
    if (expected !== session.confirmedAddressFingerprint) return null;

    if (session.fulfillmentType === "retirada") {
      return {
        type: "retirada",
        firstName: session.firstName,
        informativeEstimatedMinutes: informative.minutes,
      };
    }
    if (!selectedAddress) return null;
    return {
      type: "entrega",
      firstName: session.firstName,
      address: selectedAddress,
      informativeDeliveryFee: informative.fee,
      informativeMinimumOrder: informative.minimum,
      informativeEstimatedMinutes: informative.minutes,
    };
  }, [configuration, informative, selectedAddress, session]);

  const step: CustomerWizardStep = useMemo(() => {
    if (!hydrated || loadingConfiguration) return "loading_store";
    if (!configuration) return "error";
    if (!configuration.deliveryEnabled && !configuration.pickupEnabled) return "read_only";
    if (orderingContext) return "completed";
    if (session.wizardStep === "completed" || session.wizardStep === "loading_store") {
      return initialStep(profile, configuration);
    }
    if (session.wizardStep === "identify_customer" && profile.firstName && !session.firstName) {
      return "confirm_saved_name";
    }
    return session.wizardStep;
  }, [configuration, hydrated, loadingConfiguration, orderingContext, profile, session]);

  const draft = session.addressDraft ?? emptyDraft();

  const setStep = useCallback(
    (next: CustomerWizardStep) => persistSession({ wizardStep: next }),
    [persistSession],
  );

  const invalidateConfirmation = useCallback(
    () => persistSession({ completed: false, confirmedAddressFingerprint: null }),
    [persistSession],
  );

  const submitName = useCallback(
    (value: string) => {
      const parsed = firstNameSchema.safeParse(value);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "Informe um nome válido.";
      persistProfile({ ...profile, firstName: parsed.data });
      persistSession({
        firstName: parsed.data,
        wizardStep: stepAfterName(),
        completed: false,
        confirmedAddressFingerprint: null,
      });
      return null;
    },
    [persistProfile, persistSession, profile],
  );

  const keepSavedName = useCallback(() => {
    if (!profile.firstName) return;
    persistSession({ firstName: profile.firstName, wizardStep: stepAfterName() });
  }, [persistSession, profile.firstName]);

  const requestNameChange = useCallback(
    () => persistSession({ wizardStep: "identify_customer", firstName: null }),
    [persistSession],
  );

  const chooseFulfillment = useCallback(
    (type: FulfillmentType) => {
      persistProfile({ ...profile, lastFulfillmentPreference: type });
      persistSession({
        fulfillmentType: type,
        wizardStep: stepAfterFulfillment(type, profile),
        completed: false,
        confirmedAddressFingerprint: null,
      });
    },
    [persistProfile, persistSession, profile],
  );

  /** Clicar num endereço apenas seleciona. Nunca confirma. */
  const selectSavedAddress = useCallback(
    (localId: string) => {
      const address = profile.savedAddresses.find((item) => item.localId === localId);
      if (!address) return;
      persistSession({
        selectedAddressLocalId: localId,
        addressDraft: draftFromAddress(address),
        wizardStep: "confirm_address",
        completed: false,
        confirmedAddressFingerprint: null,
      });
    },
    [persistSession, profile.savedAddresses],
  );

  const startNewAddress = useCallback(() => {
    if (profile.savedAddresses.length >= MAX_LOCAL_ADDRESSES) {
      setNotice(`Você já salvou ${MAX_LOCAL_ADDRESSES} endereços neste aparelho.`);
      return;
    }
    persistSession({
      addressDraft: emptyDraft(),
      selectedAddressLocalId: null,
      wizardStep: "address_neighborhood",
      completed: false,
      confirmedAddressFingerprint: null,
    });
  }, [persistSession, profile.savedAddresses.length]);

  const editAddress = useCallback(
    (localId: string) => {
      const address = profile.savedAddresses.find((item) => item.localId === localId);
      if (!address) return;
      persistSession({
        addressDraft: draftFromAddress(address),
        selectedAddressLocalId: localId,
        wizardStep: "address_neighborhood",
        completed: false,
        confirmedAddressFingerprint: null,
      });
    },
    [persistSession, profile.savedAddresses],
  );

  const deleteAddress = useCallback(
    (localId: string) => {
      const remaining = profile.savedAddresses.filter((item) => item.localId !== localId);
      persistProfile({ ...profile, savedAddresses: remaining });
      if (session.selectedAddressLocalId === localId) {
        persistSession({
          selectedAddressLocalId: null,
          completed: false,
          confirmedAddressFingerprint: null,
          wizardStep: remaining.length > 0 ? "choose_saved_address" : "address_neighborhood",
        });
      }
    },
    [persistProfile, persistSession, profile, session.selectedAddressLocalId],
  );

  /** Qualquer edição de campo derruba a confirmação anterior. */
  const updateDraft = useCallback(
    (patch: Partial<AddressDraft>) => {
      persistSession({
        addressDraft: { ...draft, ...patch },
        completed: false,
        confirmedAddressFingerprint: null,
      });
    },
    [draft, persistSession],
  );

  const duplicateOf = useCallback(
    (candidate: AddressDraft) => {
      if (!candidate.neighborhoodId) return null;
      const key = addressIdentityKey({
        neighborhoodId: candidate.neighborhoodId,
        street: candidate.street,
        number: candidate.number,
        hasNoNumber: candidate.hasNoNumber,
        complement: candidate.complement,
      });
      return (
        profile.savedAddresses.find(
          (item) => item.localId !== candidate.editingLocalId && addressIdentityKey(item) === key,
        ) ?? null
      );
    },
    [profile.savedAddresses],
  );

  /** Salva o endereço no aparelho e leva à revisão — sem confirmar. */
  const saveDraftAndReview = useCallback(() => {
    if (!draft.neighborhoodId || !draft.neighborhoodNameSnapshot) {
      return "Escolha o bairro da entrega.";
    }
    if (draft.street.trim().length < 3) return WIZARD_MESSAGES.reviewAddress;
    if (!draft.hasNoNumber && draft.number.trim().length === 0) {
      return "Informe o número ou marque “Sem número”.";
    }
    if (draft.label === "Outro" && draft.customLabel.trim().length < 2) {
      return "Informe como identificar este endereço.";
    }

    const now = new Date().toISOString();
    const existing = draft.editingLocalId
      ? profile.savedAddresses.find((item) => item.localId === draft.editingLocalId)
      : undefined;

    const localId =
      existing?.localId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const address: LocalSavedAddress = {
      localId,
      label: draft.label as AddressLabel,
      customLabel: draft.label === "Outro" ? draft.customLabel.trim() : null,
      neighborhoodId: draft.neighborhoodId,
      neighborhoodNameSnapshot: draft.neighborhoodNameSnapshot,
      street: draft.street.trim(),
      number: draft.hasNoNumber ? null : draft.number.trim(),
      hasNoNumber: draft.hasNoNumber,
      complement: draft.complement.trim() || null,
      referencePoint: draft.referencePoint.trim() || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: existing?.lastUsedAt ?? null,
    };

    const others = profile.savedAddresses.filter((item) => item.localId !== localId);
    if (others.length >= MAX_LOCAL_ADDRESSES) {
      return `Você já salvou ${MAX_LOCAL_ADDRESSES} endereços neste aparelho.`;
    }

    persistProfile({ ...profile, savedAddresses: [...others, address] });
    persistSession({
      selectedAddressLocalId: localId,
      addressDraft: { ...draft, editingLocalId: localId },
      wizardStep: "confirm_address",
      completed: false,
      confirmedAddressFingerprint: null,
    });
    return null;
  }, [draft, persistProfile, persistSession, profile]);

  const runValidation = useCallback(
    async (type: FulfillmentType, areaId: string | null) => {
      if (!configuration) return null;
      const result = await postFulfillmentValidation({
        slug,
        fulfillmentType: type,
        deliveryAreaId: areaId,
        configurationVersion: configuration.configurationVersion,
      });
      return result;
    },
    [configuration, slug],
  );

  const confirmAddress = useCallback(async () => {
    if (!configuration || !selectedAddress || !session.firstName) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await runValidation("entrega", selectedAddress.neighborhoodId);
      if (!result) return;
      if (!result.isValid) {
        setNotice(messageForValidationError(result.validationErrors[0] ?? ""));
        if (result.validationErrors.includes("CONFIGURATION_CHANGED")) setReloadToken((t) => t + 1);
        persistSession({ completed: false, confirmedAddressFingerprint: null });
        return;
      }
      setInformative({
        fee: result.deliveryFee,
        minimum: result.minimumOrderAmount,
        minutes: result.estimatedMinutes,
      });
      const now = new Date().toISOString();
      persistProfile({
        ...profile,
        savedAddresses: profile.savedAddresses.map((item) =>
          item.localId === selectedAddress.localId ? { ...item, lastUsedAt: now } : item,
        ),
      });
      persistSession({
        fulfillmentType: "entrega",
        completed: true,
        wizardStep: "completed",
        fulfillmentConfigurationVersion: result.configurationVersion,
        confirmedAddressFingerprint: confirmationFingerprint({
          fulfillmentType: "entrega",
          configurationVersion: configuration.configurationVersion,
          address: { ...selectedAddress, lastUsedAt: now },
        }),
      });
    } catch {
      setNotice(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? WIZARD_MESSAGES.offlineDraftKept
          : WIZARD_MESSAGES.fulfillmentLoadFailed,
      );
    } finally {
      setBusy(false);
    }
  }, [
    configuration,
    persistProfile,
    persistSession,
    profile,
    runValidation,
    selectedAddress,
    session.firstName,
  ]);

  const confirmPickup = useCallback(async () => {
    if (!configuration || !session.firstName) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await runValidation("retirada", null);
      if (!result) return;
      if (!result.isValid) {
        setNotice(messageForValidationError(result.validationErrors[0] ?? ""));
        if (result.validationErrors.includes("CONFIGURATION_CHANGED")) setReloadToken((t) => t + 1);
        return;
      }
      setInformative({ fee: null, minimum: null, minutes: result.estimatedMinutes });
      persistSession({
        fulfillmentType: "retirada",
        completed: true,
        wizardStep: "completed",
        selectedAddressLocalId: null,
        fulfillmentConfigurationVersion: result.configurationVersion,
        confirmedAddressFingerprint: confirmationFingerprint({
          fulfillmentType: "retirada",
          configurationVersion: configuration.configurationVersion,
          address: null,
        }),
      });
    } catch {
      setNotice(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? WIZARD_MESSAGES.offlineDraftKept
          : WIZARD_MESSAGES.fulfillmentLoadFailed,
      );
    } finally {
      setBusy(false);
    }
  }, [configuration, persistSession, runValidation, session.firstName]);

  const reopenWizard = useCallback(() => {
    invalidateConfirmation();
    persistSession({ wizardStep: "choose_fulfillment" });
  }, [invalidateConfirmation, persistSession]);

  const restartDraft = useCallback(() => {
    persistSession({
      addressDraft: emptyDraft(),
      wizardStep: "address_neighborhood",
      completed: false,
      confirmedAddressFingerprint: null,
    });
  }, [persistSession]);

  const forgetLocalData = useCallback(() => {
    forgetStore(slug);
    setProfile(emptyProfile());
    setSession(emptySession());
    setInformative({ fee: null, minimum: null, minutes: null });
    setNotice(null);
  }, [slug]);

  const setReturnPath = useCallback(
    (path: string | null) => {
      const safe = sanitizeReturnPath(path, slug);
      if (safe !== session.safeReturnPath) persistSession({ safeReturnPath: safe });
    },
    [persistSession, session.safeReturnPath, slug],
  );

  const goBack = useCallback(() => {
    persistSession({ wizardStep: stepBack(step, profile) });
  }, [persistSession, profile, step]);

  const value = useMemo<WizardContextValue>(
    () => ({
      slug,
      hydrated,
      storageAvailable,
      configuration,
      configurationError,
      loadingConfiguration,
      reloadConfiguration: () => setReloadToken((token) => token + 1),
      profile,
      session,
      step,
      notice,
      busy,
      orderingContext,
      selectedAddress,
      draft,
      informative,
      setStep,
      goBack,
      submitName,
      keepSavedName,
      requestNameChange,
      chooseFulfillment,
      selectSavedAddress,
      startNewAddress,
      editAddress,
      deleteAddress,
      updateDraft,
      duplicateOf,
      saveDraftAndReview,
      confirmAddress,
      confirmPickup,
      reopenWizard,
      forgetLocalData,
      setReturnPath,
      restartDraft,
    }),
    [
      busy,
      chooseFulfillment,
      configuration,
      configurationError,
      confirmAddress,
      confirmPickup,
      deleteAddress,
      draft,
      duplicateOf,
      editAddress,
      forgetLocalData,
      goBack,
      hydrated,
      informative,
      keepSavedName,
      loadingConfiguration,
      notice,
      orderingContext,
      profile,
      requestNameChange,
      reopenWizard,
      restartDraft,
      saveDraftAndReview,
      selectSavedAddress,
      selectedAddress,
      session,
      setReturnPath,
      setStep,
      slug,
      startNewAddress,
      status(step),
      storageAvailable,
      submitName,
      updateDraft,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Identidade estável da etapa (evita recriar o contexto sem necessidade). */
function status(step: CustomerWizardStep): string {
  return step;
}

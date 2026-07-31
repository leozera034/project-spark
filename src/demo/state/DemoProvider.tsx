import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";

import { demoAudit, demoSupportTickets } from "../data/demoAudit";
import { DEMO_SESSION_COURIER_ID, demoCouriers, demoDeliveries } from "../data/demoCouriers";
import { demoOrders } from "../data/demoOrders";
import { demoInvoices, demoPlans, demoSaasStores, demoStoreUsers } from "../data/demoPlans";
import { demoProducts } from "../data/demoProducts";
import { demoNeighborhoods, demoStore } from "../data/demoStore";
import { demoCustomer, demoSavedAddress } from "../data/demoUsers";
import type {
  CourierDeliveryStatus,
  DemoAddress,
  DemoCartLine,
  DemoDelivery,
  DemoOrder,
  DemoSaasStore,
  Fulfillment,
  OrderStatus,
  PaymentMethod,
} from "../types/demo";

/**
 * Sinalizador do modo de demonstração da Fase 03.
 * Não é, e nunca será, um mecanismo de segurança.
 */
export const IS_DEMO_MODE = true;

export const DEMO_VERSION = "Fase 03 — protótipo v0.3.0";

export interface CustomerSession {
  firstName: string;
  phone: string;
  fulfillment: Fulfillment | null;
  address: DemoAddress | null;
  addressConfirmed: boolean;
  cart: DemoCartLine[];
  paymentMethod: PaymentMethod | null;
  changeFor: string;
  generalNote: string;
  placedOrderCode: string | null;
}

const initialCustomer: CustomerSession = {
  firstName: "",
  phone: demoCustomer.phone,
  fulfillment: null,
  address: null,
  addressConfirmed: false,
  cart: [],
  paymentMethod: null,
  changeFor: "",
  generalNote: "",
  placedOrderCode: null,
};

export interface DemoContextValue {
  store: typeof demoStore;
  neighborhoods: typeof demoNeighborhoods;
  products: typeof demoProducts;
  savedAddress: DemoAddress;
  plans: typeof demoPlans;
  invoices: typeof demoInvoices;
  storeUsers: typeof demoStoreUsers;
  audit: typeof demoAudit;
  supportTickets: typeof demoSupportTickets;

  storeOpen: boolean;
  toggleStoreOpen: () => void;

  customer: CustomerSession;
  updateCustomer: (patch: Partial<CustomerSession>) => void;
  addCartLine: (line: DemoCartLine) => void;
  updateCartLine: (id: string, patch: Partial<DemoCartLine>) => void;
  removeCartLine: (id: string) => void;
  placeOrder: () => string;

  orders: DemoOrder[];
  setOrderStatus: (id: string, status: OrderStatus, reason?: string) => void;
  assignCourier: (orderId: string, courierId: string) => void;

  couriers: typeof demoCouriers;
  sessionCourierId: string;
  courierOnline: boolean;
  toggleCourierOnline: () => void;
  deliveries: DemoDelivery[];
  setDeliveryStatus: (id: string, status: CourierDeliveryStatus) => void;
  registerIncident: (id: string, incident: string) => void;

  saasStores: DemoSaasStore[];
  setSaasStoreStatus: (id: string, status: DemoSaasStore["status"]) => void;

  resetDemo: () => void;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [storeOpen, setStoreOpen] = useState(demoStore.isOpen);
  const [customer, setCustomer] = useState<CustomerSession>(initialCustomer);
  const [orders, setOrders] = useState<DemoOrder[]>(demoOrders);
  const [deliveries, setDeliveries] = useState<DemoDelivery[]>(demoDeliveries);
  const [courierOnline, setCourierOnline] = useState(true);
  const [saasStores, setSaasStores] = useState<DemoSaasStore[]>(demoSaasStores);

  const updateCustomer = useCallback((patch: Partial<CustomerSession>) => {
    setCustomer((current) => ({ ...current, ...patch }));
  }, []);

  const addCartLine = useCallback((line: DemoCartLine) => {
    setCustomer((current) => ({ ...current, cart: [...current.cart, line] }));
  }, []);

  const updateCartLine = useCallback((id: string, patch: Partial<DemoCartLine>) => {
    setCustomer((current) => ({
      ...current,
      cart: current.cart.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }, []);

  const removeCartLine = useCallback((id: string) => {
    setCustomer((current) => ({ ...current, cart: current.cart.filter((line) => line.id !== id) }));
  }, []);

  const placeOrder = useCallback(() => {
    const code = "A-1046";
    setCustomer((current) => ({ ...current, placedOrderCode: code }));
    return code;
  }, []);

  const setOrderStatus = useCallback((id: string, status: OrderStatus, reason?: string) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === id ? { ...order, status, cancelReason: reason ?? order.cancelReason } : order,
      ),
    );
  }, []);

  const assignCourier = useCallback((orderId: string, courierId: string) => {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, courierId } : order)),
    );
  }, []);

  const setDeliveryStatus = useCallback((id: string, status: CourierDeliveryStatus) => {
    setDeliveries((current) =>
      current.map((delivery) =>
        delivery.id === id
          ? { ...delivery, status, finishedAt: status === "entregue" ? "Agora" : delivery.finishedAt }
          : delivery,
      ),
    );
  }, []);

  const registerIncident = useCallback((id: string, incident: string) => {
    setDeliveries((current) =>
      current.map((delivery) => (delivery.id === id ? { ...delivery, incident } : delivery)),
    );
  }, []);

  const setSaasStoreStatus = useCallback((id: string, status: DemoSaasStore["status"]) => {
    setSaasStores((current) =>
      current.map((store) => (store.id === id ? { ...store, status } : store)),
    );
  }, []);

  const resetDemo = useCallback(() => {
    setStoreOpen(demoStore.isOpen);
    setCustomer(initialCustomer);
    setOrders(demoOrders);
    setDeliveries(demoDeliveries);
    setCourierOnline(true);
    setSaasStores(demoSaasStores);
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      store: demoStore,
      neighborhoods: demoNeighborhoods,
      products: demoProducts,
      savedAddress: demoSavedAddress,
      plans: demoPlans,
      invoices: demoInvoices,
      storeUsers: demoStoreUsers,
      audit: demoAudit,
      supportTickets: demoSupportTickets,
      storeOpen,
      toggleStoreOpen: () => setStoreOpen((open) => !open),
      customer,
      updateCustomer,
      addCartLine,
      updateCartLine,
      removeCartLine,
      placeOrder,
      orders,
      setOrderStatus,
      assignCourier,
      couriers: demoCouriers,
      sessionCourierId: DEMO_SESSION_COURIER_ID,
      courierOnline,
      toggleCourierOnline: () => setCourierOnline((online) => !online),
      deliveries,
      setDeliveryStatus,
      registerIncident,
      saasStores,
      setSaasStoreStatus,
      resetDemo,
    }),
    [
      storeOpen,
      customer,
      updateCustomer,
      addCartLine,
      updateCartLine,
      removeCartLine,
      placeOrder,
      orders,
      setOrderStatus,
      assignCourier,
      courierOnline,
      deliveries,
      setDeliveryStatus,
      registerIncident,
      saasStores,
      setSaasStoreStatus,
      resetDemo,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

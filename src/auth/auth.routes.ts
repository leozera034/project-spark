export const AUTH_ROUTES = {
  storeSignIn: "/entrar/loja",
  adminSignIn: "/entrar/admin",
  courierSignIn: "/entrar/entregador",
  recovery: "/recuperar-acesso",
  resetPassword: "/redefinir-senha",
  initialPasswordChange: "/trocar-senha-inicial",
  noAccess: "/sem-acesso",
} as const;

export const APP_ROUTES = {
  store: "/app/loja",
  courier: "/app/entregador",
  admin: "/admin",
} as const;

export const PUBLIC_ROUTE_PREFIXES = [
  "/",
  "/loja",
  "/criar-loja",
  "/preview",
  "/design-system",
  "/entrar",
  "/recuperar-acesso",
  "/redefinir-senha",
  "/sem-acesso",
] as const;

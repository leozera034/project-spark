import { useContext } from "react";

import { AuthContext } from "./AuthContext";
import type { AuthValue } from "./auth.types";

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth precisa estar dentro de AuthProvider");
  }
  return value;
}

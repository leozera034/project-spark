import { useContext } from "react";

import { DemoContext, type DemoContextValue } from "./DemoProvider";

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo precisa estar dentro de DemoProvider.");
  }
  return context;
}

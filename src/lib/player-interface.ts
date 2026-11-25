import { useEffect, useState } from "react";

export const UNIFIED_SKINS = ["silver", "modern", "matrix"] as const;
export type PlayerInterface = "unified" | "classic";
export function readPlayerInterface(storage: Pick<Storage, "getItem">): PlayerInterface {
  return storage.getItem("amply-interface") === "classic" ? "classic" : "unified";
}
export function usePlayerInterface() {
  const [layout, setLayout] = useState<PlayerInterface>("unified");
  useEffect(() => {
    const read = () => setLayout(readPlayerInterface(localStorage));
    read(); window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);
  const change = (value: PlayerInterface) => {
    localStorage.setItem("amply-interface", value); setLayout(value);
  };
  return [layout, change] as const;
}
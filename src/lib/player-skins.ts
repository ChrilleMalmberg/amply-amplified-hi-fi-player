export const PLAYER_SKINS = ["silver", "classic", "nucleo", "ruby", "matrix", "modern"] as const;

export function savePlayerSkin(skin: string, storage: Pick<Storage, "getItem" | "setItem">) {
  if (!PLAYER_SKINS.some(candidate => candidate === skin)) return;
  let state: Record<string, unknown> = {};
  try {
    const saved = JSON.parse(storage.getItem("wa-state") || "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) state = saved;
  } catch { /* Recover an unreadable saved appearance. */ }
  storage.setItem("wa-state", JSON.stringify({ ...state, v: 4, skin }));
}
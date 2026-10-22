import type { StoredItem } from "./playlist-store";

export type LibraryGroup = "artist" | "album" | "genre" | "folder" | "source";
export const GROUP_LABELS: Record<LibraryGroup, string> = { artist: "Artists", album: "Albums", genre: "Genres", folder: "Folders", source: "Sources" };

export function fileIdentity(file: File, folder = "") {
  return `${folder}/${file.name}:${file.size}:${file.lastModified}`;
}

export function organizeFile(file: File, tags: { title?: string; artist?: string; album?: string; genre?: string[]; duration?: number | undefined; track?: { no: number | null } }): StoredItem {
  const path = file.webkitRelativePath || file.name;
  const parts = path.split("/");
  const folder = parts.slice(0, -1).join("/") || "Loose files";
  return {
    file, folder, source: parts.length > 1 ? parts[0] ?? "Loose files" : "Loose files",
    title: tags.title || file.name.replace(/\.[^.]+$/, ""),
    artist: tags.artist || (parts.length >= 4 ? parts[parts.length - 3] : undefined) || "Unknown artist",
    album: tags.album || (parts.length >= 3 ? parts[parts.length - 2] : undefined) || "Unknown album",
    genre: tags.genre?.join(", ") || "Uncategorized",
    duration: Number.isFinite(tags.duration) ? tags.duration ?? 0 : 0,
    trackNumber: tags.track?.no ?? 0,
  };
}

export function mergeLibrary(existing: StoredItem[], incoming: StoredItem[]) {
  const entries = new Map(existing.map(item => [fileIdentity(item.file, item.folder), item]));
  incoming.forEach(item => entries.set(fileIdentity(item.file, item.folder), item));
  return [...entries.values()];
}

export function filterLibrary(items: StoredItem[], query: string, group: LibraryGroup, selected: string, source: string) {
  const q = query.trim().toLocaleLowerCase();
  return items.filter(item => (!source || item.source === source) && (!selected || item[group] === selected) &&
    (!q || [item.title, item.artist, item.album, item.genre, item.folder].join(" ").toLocaleLowerCase().includes(q)))
    .sort((a, b) => (a.artist || "").localeCompare(b.artist || "") || (a.album || "").localeCompare(b.album || "") || (a.trackNumber || 0) - (b.trackNumber || 0) || a.title.localeCompare(b.title));
}
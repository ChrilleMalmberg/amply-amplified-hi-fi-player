import { useEffect, useRef, useState } from "react";
import { LIBRARY_KEY, loadPlaylist, savePlaylist, type StoredItem } from "@/lib/playlist-store";
import { mergeLibrary, organizeFile } from "@/lib/music-library";
import { AUDIO_EXT } from "./player-context";

export function useMusicLibrary() {
  const [items, setItems] = useState<StoredItem[]>([]);
  const itemsRef = useRef<StoredItem[]>([]);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    loadPlaylist(LIBRARY_KEY).then(list => {
      if (!active) return;
      itemsRef.current = list?.items || [];
      setItems(itemsRef.current);
    }).catch(() => active && setError("Music storage unavailable")).finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);

  const importFiles = async (files: File[]) => {
    if (busy.current || !ready) return;
    busy.current = true;
    setError("");
    const audio = files.filter(file => file.type.startsWith("audio/") || AUDIO_EXT.test(file.name));
    setProgress({ done: 0, total: audio.length });
    try {
      const { parseBlob } = await import("music-metadata");
      const added: StoredItem[] = [];
      for (const file of audio) {
        const metadata = await parseBlob(file, { skipCovers: true }).catch(() => null);
        added.push(organizeFile(file, { ...metadata?.common, duration: metadata?.format.duration }));
        setProgress({ done: added.length, total: audio.length });
      }
      const next = mergeLibrary(itemsRef.current, added);
      await savePlaylist({ name: LIBRARY_KEY, items: next, savedAt: Date.now() });
      itemsRef.current = next;
      setItems(next);
      if (!audio.length) setError("No audio files found");
    } catch {
      setError("Import could not be saved. Check available disk space and try again.");
    } finally {
      busy.current = false;
      setProgress(null);
    }
  };
  return { items, ready, progress, error, importFiles };
}
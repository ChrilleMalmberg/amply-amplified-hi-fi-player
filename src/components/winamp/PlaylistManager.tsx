import { useEffect, useState } from "react";
import { usePlayer } from "./player-context";
import { deletePlaylist, listPlaylists, loadPlaylist } from "@/lib/playlist-store";

export function PlaylistManager({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  const [lists, setLists] = useState<{ name: string; count: number; savedAt: number }[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const refresh = () => listPlaylists().then(setLists).catch(() => setMsg("Storage unavailable"));
  useEffect(() => {
    void refresh();
  }, []);

  const save = async () => {
    const n = name.trim();
    if (!n || !p.tracks.length) return setMsg(p.tracks.length ? "Type a name" : "Playlist is empty");
    try {
      await p.saveAs(n);
      setMsg(`Saved "${n}"`);
      setName("");
      void refresh();
    } catch {
      setMsg("Not enough storage space");
    }
  };

  return (
    <div className="wa-plm">
      <div className="wa-pl-bar">
        <input
          className="wa-lcd wa-small wa-grow wa-input"
          placeholder="Playlist name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <button className="wa-toggle" onClick={save}>SAVE</button>
        <button className="wa-toggle" onClick={onClose}>CLOSE</button>
      </div>
      {msg && <div className="wa-pl-warn">{msg}</div>}
      <div className="wa-plm-list">
        {lists.length === 0 && <div className="wa-pl-empty">No saved playlists yet</div>}
        {lists.map((l) => (
          <div key={l.name} className="wa-pl-row">
            <span className="wa-pl-name">
              {l.name} ({l.count})
            </span>
            <span className="wa-plm-actions">
              <button
                className="wa-toggle"
                onClick={async () => {
                  const pl = await loadPlaylist(l.name);
                  if (pl) {
                    p.loadItems(pl.items);
                    setMsg(`Loaded "${l.name}"`);
                  }
                }}
              >
                LOAD
              </button>
              <button
                className="wa-toggle"
                onClick={async () => {
                  await deletePlaylist(l.name);
                  void refresh();
                }}
              >
                DEL
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

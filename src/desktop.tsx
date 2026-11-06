import { createRoot } from "react-dom/client";
import { Desktop } from "@/components/winamp/Desktop";
import "./styles.css";

// Electron serves a client-only document. Hydrating a prerendered web shell in
// independent native panels caused a mismatch on every window's first load.
const root = document.getElementById("root");
if (!root) throw new Error("AmPly desktop root is missing");
createRoot(root).render(<Desktop />);

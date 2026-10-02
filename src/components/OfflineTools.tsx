import { useEffect, useRef, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { offlineToolsReady, prepareOfflineTools } from "../lib/offline-tools";
import { useApp } from "../lib/context";
import { safeImportMessage } from "../lib/security";
export function OfflineTools() {
  const { toast } = useApp(), controller = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { offlineToolsReady().then(setReady).catch(() => {}); return () => controller.current?.abort(); }, []);
  return <div className="offline-tools"><h3><ShieldCheck size={17} /> Offline document tools</h3><p className="fine-print">Your workspace works offline after the app shell is cached. Prepare the local PDF and OCR tools to import new documents offline too. This downloads about 24 MB of application assets; it does not send your documents anywhere.</p><button className="button secondary small" disabled={busy || ready} onClick={async () => { const operation = new AbortController(); controller.current = operation; setBusy(true); try { await prepareOfflineTools(operation.signal, setMessage); setReady(true); toast("Local import tools are ready offline"); } catch (error) { if (!operation.signal.aborted) toast(safeImportMessage(error, "Could not prepare offline tools")); } finally { setBusy(false); controller.current = null; } }}><Download size={15} /> {ready ? "Offline tools ready" : busy ? "Preparing tools…" : "Prepare offline import tools"}</button>{busy && <button className="text-link" onClick={() => controller.current?.abort()}>Cancel download</button>}{message && <p className="fine-print" role="status">{message}</p>}</div>;
}

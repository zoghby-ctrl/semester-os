import { useRef, useState } from "react";
import { importBackup, initialize, validateBackup } from "../lib/db";
import { MAX_BACKUP_BYTES, parseBackupJson, safeImportMessage } from "../lib/security";
import { LegalLinks } from "../pages/Legal";
export function StorageRecovery() {
  const file = useRef<HTMLInputElement>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <div className="boot"><h1>Local storage needs attention</h1><p>Semester OS could not safely open its saved workspace. Your stored information has been retained. Allow site storage and reload, or restore a known-good backup. A restore replaces the workspace and creates a local recovery point.</p>
    <div className="backup-actions"><button className="button secondary" onClick={() => location.reload()}>Reload</button><button className="button" disabled={busy} onClick={() => file.current?.click()}>Restore a backup</button></div>
    <input ref={file} type="file" className="sr-only" accept="application/json,.json" aria-label="Restore known-good backup" onChange={async e => { const selected = e.target.files?.[0]; e.target.value = ""; if (!selected) return; setBusy(true); setError(""); try { if (selected.size > MAX_BACKUP_BYTES) throw new Error("Backup must be smaller than 100 MB"); const input = validateBackup(parseBackupJson(await selected.text())); if (!window.confirm("Replace the saved workspace with this validated backup? A local recovery point will be kept.")) return; await importBackup(input); await initialize(); location.reload(); } catch (cause) { setError(safeImportMessage(cause)); } finally { setBusy(false); } }} />
    {error && <p role="alert" className="form-error">{error}</p>}<LegalLinks /></div>;
}

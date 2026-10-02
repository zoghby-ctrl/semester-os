import { useEffect, useRef, useState } from "react";
export function Slider({ label, value, onChange, min = 0, max, unit, disabled = false }: {
  label: string; value: number; onChange: (v: number) => void | Promise<boolean>; min?: number; max: number; unit: string; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const pending = useRef(0), revision = useRef(0), external = useRef(value); external.current = value;
  useEffect(() => { if (pending.current === 0) setDraft(value); }, [value]);
  const change = (next: number) => {
    setDraft(next); const request = ++revision.current; pending.current++;
    void Promise.resolve(onChange(next)).then(saved => { if (saved === false && request === revision.current) setDraft(external.current); }).finally(() => pending.current--);
  };
  return <label className="slider-label"><span>{label}<strong>{draft}{unit}</strong></span>
    <input type="range" disabled={disabled} min={min} max={max} value={draft} onChange={e => change(Number(e.target.value))} /></label>;
}

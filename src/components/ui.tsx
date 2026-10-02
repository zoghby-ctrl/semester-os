import { useApp } from "../lib/context";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUpRight, Plus, Check } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";

import { statusLabel } from "../lib/scheduling";
import { progressFraction } from "../themes/motion";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay motion-modal-overlay" />
        <Dialog.Content
          className={`modal motion-modal ${wide ? "wide" : ""}`}
          aria-describedby={description ? "modal-description" : undefined}
        >
          <div className="modal-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id="modal-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Status({
  status,
  minutes,
}: {
  status: string;
  minutes?: number;
}) {
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" />
      {statusLabel(status)}
      {status === "late" && minutes !== undefined ? ` · ${minutes}m` : ""}
    </span>
  );
}
export function CourseTag({ id }: { id: string }) {
  const { courseById } = useApp();
  const c = courseById(id);
  return (
    <span
      className="course-code"
      style={{ "--course": c.color } as CSSProperties}
    >
      <i />
      {c.code}
    </span>
  );
}
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <span className="empty-icon">{icon}</span>}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function Ring({
  value,
  label,
  size = 112,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const percentage = progressFraction(value) * 100;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${label}: ${Math.round(percentage)}%`}
      >
        <circle className="ring-track" cx="50" cy="50" r="43" />
        <circle
          className="ring-fill"
          cx="50"
          cy="50"
          r="43"
          strokeDasharray="270.2"
          strokeDashoffset={270.2 * (1 - percentage / 100)}
        />
      </svg>
      <div>
        <strong>
          {Math.round(percentage)}
          <small>%</small>
        </strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
export function ProgressBar({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  const fraction = progressFraction(value);
  return (
    <div
      className="progress-track motion-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          transform: `scaleX(${fraction})`,
          background: color,
        }}
      />
    </div>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="button small secondary" onClick={onClick}>
      <Plus size={15} />
      {children}
    </button>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch">
        <Check size={12} />
      </span>
    </label>
  );
}

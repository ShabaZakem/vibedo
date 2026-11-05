import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '../lib/utils'

/* ---------------- toast ---------------- */
interface ToastStore {
  message: string | null
  show: (message: string) => void
  clear: () => void
}

export const useToast = create<ToastStore>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}))

let toastTimer: number | undefined

export function toast(message: string): void {
  useToast.getState().show(message)
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => useToast.getState().clear(), 2600)
}

export function ToastHost() {
  const message = useToast((state) => state.message)
  if (!message) return null
  return createPortal(<div className="toast">{message}</div>, document.body)
}

/* ---------------- logo ---------------- */
export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.2 4.2L19 6.8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ---------------- modal ---------------- */
interface ModalProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ open, title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={cn('modal', wide && 'wide')} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Закрити">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- confirm ---------------- */
interface ConfirmProps {
  open: boolean
  title: string
  text: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel = 'Скасувати',
  danger = true,
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn btn-soft" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={cn('btn', danger ? 'btn-danger' : 'btn-primary')}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="modal-text" style={{ margin: 0 }}>
        {text}
      </p>
    </Modal>
  )
}

/* ---------------- switch ---------------- */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn('switch', checked && 'on')}
      onClick={() => onChange(!checked)}
    />
  )
}

/* ---------------- segmented ---------------- */
interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={cn(value === option.value && 'active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- ticker ---------------- */
export function useTick(interval = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(id)
  }, [interval])
  return now
}

/* ---------------- ring ---------------- */
export function Ring({
  value,
  max,
  center,
  sub,
  size = 92,
  stroke = 8,
}: {
  value: number
  max: number
  center: ReactNode
  sub: ReactNode
  size?: number
  stroke?: number
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="ring-center">
        <b>{center}</b>
        <span>{sub}</span>
      </div>
    </div>
  )
}

/* ---------------- chart ---------------- */
export interface ChartPoint {
  key: string
  label: string
  value: number
  tooltip: string
}

export function BarChart({
  points,
  color,
  formatValue,
}: {
  points: ChartPoint[]
  color?: string
  formatValue?: (value: number) => string
}) {
  const max = useMemo(() => Math.max(0, ...points.map((point) => point.value)), [points])
  if (points.length === 0 || max === 0) {
    return <div className="chart-empty">Ще немає даних за цей період</div>
  }
  const step = Math.max(1, Math.ceil(points.length / 8))
  return (
    <div className="chart-wrap">
      <div className="chart">
        {points.map((point) => {
          const height = max > 0 ? Math.max(2, (point.value / max) * 100) : 2
          return (
            <div className="chart-col" key={point.key}>
              <div className="chart-tip">{point.tooltip}</div>
              <div
                className="chart-bar"
                style={{
                  height: `${height}%`,
                  background: color
                    ? `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 60%, transparent))`
                    : undefined,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="chart-axis">
        {points.map((point, index) => (
          <span key={point.key}>
            {index % step === 0 || index === points.length - 1 ? point.label : ''}
          </span>
        ))}
      </div>
      {formatValue && max > 0 && (
        <div className="field-hint" style={{ textAlign: 'right' }}>
          Максимум: {formatValue(max)}
        </div>
      )}
    </div>
  )
}

/* ---------------- field ---------------- */
export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/* ---------------- checkbox ---------------- */
export function RoundCheck({
  checked,
  onClick,
  label,
}: {
  checked: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      className={cn('task-check', checked && 'checked')}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <Check size={12} strokeWidth={3.2} />
    </button>
  )
}

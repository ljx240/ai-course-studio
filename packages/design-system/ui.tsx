import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { legacy } from '../subject-sdk/legacy'

export function Icon({ name, size = 17 }: { name: string; size?: number }) {
  // Paths are bundled source assets, with no content or model input.
  const paths = legacy.data.iconPaths[name] ?? legacy.data.iconPaths.info
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: paths }} />
}

export function Button({ children, kind = 'normal', icon, className, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'normal' | 'primary' | 'quiet'; icon?: string }) {
  return <button type="button" className={`button ${kind} ${className ?? ''}`} {...props}>
    {icon && <Icon name={icon} />}{children}
  </button>
}

export function Card({ title, icon, action, children, tone = '' }: {
  title: string; icon: string; action?: ReactNode; children: ReactNode; tone?: string
}) {
  return <section className={`card ${tone}`}>
    <header className="card-head"><Icon name={icon} /><h2>{title}</h2>{action}</header>
    {children}
  </section>
}

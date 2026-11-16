import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import './ui.css';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' };
export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) { return <button type={type} className={`ui-button ui-button--${variant} ${className}`} {...props} />; }
export function IconButton({ className = '', ...props }: ButtonProps) { return <Button className={`ui-icon-button ${className}`} {...props} />; }
export function Badge({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) { return <span className={`ui-badge ${className}`} {...props} />; }
export function Chip({ active = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) { return <button type="button" aria-pressed={active} className={`ui-chip ${className}`} {...props} />; }
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`ui-input ${className}`} {...props} />; }
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={`ui-input ${className}`} {...props} />; }
export function Tooltip({ content, children }: { content: string; children: ReactNode }) { return <span className="ui-tooltip" tabIndex={0}>{children}<span role="tooltip">{content}</span></span>; }
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`ui-card ${className}`} {...props} />; }
export function Divider() { return <hr className="ui-divider" />; }
export function SegmentedControl<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (value: T) => void; label: string }) { return <div className="ui-segmented" role="group" aria-label={label}>{options.map(option => <Chip key={option.value} active={value === option.value} disabled={option.disabled} onClick={() => onChange(option.value)}>{option.label}</Chip>)}</div>; }
export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) { return <div aria-hidden="true" className={`ui-skeleton ${className}`} {...props} />; }

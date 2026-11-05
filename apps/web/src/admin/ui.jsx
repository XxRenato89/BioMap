/*
 * Piezas comunes del panel: botones, campos y avisos con el mismo estilo.
 */
export const inputClass =
  'w-full rounded-lg border border-forest/25 bg-white px-3 py-2 text-base text-ink focus:outline-2 focus:outline-focus';

const VARIANTS = {
  primary: 'bg-forest text-cream hover:bg-forest-dark',
  ghost: 'bg-transparent text-forest hover:bg-forest/10',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

export function Button({ variant = 'primary', type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border-0 px-4 py-2 font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-bold text-forest">
      {label}
      {children}
      {hint && <span className="font-normal text-muted">{hint}</span>}
    </label>
  );
}

const TONES = {
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  ok: 'bg-green-50 text-green-800 border-green-200',
};

export function Notice({ tone = 'ok', children }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`m-0 rounded-lg border px-3 py-2 ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}

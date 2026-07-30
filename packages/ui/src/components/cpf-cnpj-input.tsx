import * as React from 'react'

import { cn } from '@workspace/ui/lib/utils'

// --- Validation ---

export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== Number(digits[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  return remainder === Number(digits[10])
}

export function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(digits.charAt(i)) * weights1[i]!
  }
  let remainder = sum % 11
  const firstVerifier = remainder < 2 ? 0 : 11 - remainder
  if (firstVerifier !== Number(digits[12])) return false

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += Number(digits.charAt(i)) * weights2[i]!
  }
  remainder = sum % 11
  const secondVerifier = remainder < 2 ? 0 : 11 - remainder
  return secondVerifier === Number(digits[13])
}

export function validateCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return true
  if (digits.length <= 11) return validateCpf(digits)
  return validateCnpj(digits)
}

// --- Formatting ---

export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

// --- Component ---

export interface CpfCnpjInputProps extends Omit<
  React.ComponentProps<'input'>,
  'onChange' | 'value'
> {
  value?: string
  onChange?: (value: string) => void
  onValidate?: (valid: boolean) => void
}

const CpfCnpjInput = React.forwardRef<HTMLInputElement, CpfCnpjInputProps>(
  ({ className, value = '', onChange, onValidate, onBlur, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
      onChange?.(digits)
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      if (onValidate) {
        const digits = (value ?? '').replace(/\D/g, '')
        onValidate(validateCpfCnpj(digits))
      }
      onBlur?.(e)
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        data-slot="input"
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className,
        )}
        value={formatCpfCnpj(value ?? '')}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={18}
        placeholder="000.000.000-00"
        {...props}
      />
    )
  },
)
CpfCnpjInput.displayName = 'CpfCnpjInput'

export { CpfCnpjInput }

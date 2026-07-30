import * as React from 'react'

import {
  CurrencyInput as ReactCurrencyInput,
  type CurrencyInputProps as ReactCurrencyInputProps,
} from 'react-currency-input-field'

import { cn } from '@workspace/ui/lib/utils'

export interface CurrencyInputProps extends Omit<
  ReactCurrencyInputProps,
  'intlConfig' | 'prefix' | 'decimalSeparator' | 'groupSeparator'
> {
  intlConfig?: ReactCurrencyInputProps['intlConfig']
  prefix?: string
  decimalSeparator?: string
  groupSeparator?: string
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      intlConfig,
      prefix,
      decimalSeparator,
      groupSeparator,
      decimalsLimit,
      allowDecimals,
      allowNegativeValue,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={cn(
          'border-input focus-within:border-ring focus-within:ring-ring/50 flex h-9 overflow-hidden rounded-md border shadow-xs transition-all focus-within:ring-[3px]',
          props.disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <div className="bg-muted text-muted-foreground flex shrink-0 items-center border-r px-3 text-sm font-semibold select-none">
          R$
        </div>

        <ReactCurrencyInput
          ref={ref}
          data-slot="currency-input"
          decimalsLimit={decimalsLimit ?? 2}
          allowDecimals={allowDecimals ?? true}
          allowNegativeValue={allowNegativeValue ?? false}
          prefix={prefix ?? ''}
          decimalSeparator={decimalSeparator ?? ','}
          groupSeparator={groupSeparator ?? '.'}
          intlConfig={intlConfig}
          className={cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-full w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 py-1 text-base shadow-none outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            'focus-visible:ring-0',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)

CurrencyInput.displayName = 'CurrencyInput'

export { CurrencyInput }

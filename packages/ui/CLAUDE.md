# @workspace/ui

Shared UI component package for turborepo-saas-starter.

**Stack:** shadcn/ui (new-york style) + Radix UI + Tailwind CSS v4 + CVA + React Hook Form

## Commands

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (sem build)
```

> O pacote não tem etapa de build — exporta os arquivos-fonte diretamente.

## Exports

```typescript
import { Button, Card } from '@workspace/ui/components'
import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { useIsMobile } from '@workspace/ui/hooks/use-mobile'
import '@workspace/ui/globals.css'
```

## Structure

```
src/
├── components/
│   ├── index.ts          # Barrel de todos os componentes
│   ├── *.tsx             # Componentes shadcn/ui (padrão)
│   ├── cpf-cnpj-input.tsx     # Input CPF/CNPJ com validação
│   ├── currency-input.tsx     # Input monetário (R$, formato BR)
│   ├── phone-input.tsx        # Input telefone internacional
│   ├── password-input.tsx     # Input senha com toggle show/hide
│   ├── field.tsx              # FieldSet/FieldGroup para layout de formulários
│   ├── empty.tsx              # Componentes de estado vazio
│   ├── input-group.tsx        # Wrapper de agrupamento de inputs
│   ├── button-group.tsx       # Agrupamento de botões
│   ├── item.tsx               # Componente de item genérico
│   ├── kbd.tsx                # Tecla de teclado (keyboard shortcut)
│   └── spinner.tsx            # Indicador de carregamento
├── hooks/
│   └── use-mobile.ts          # useIsMobile() — breakpoint 768px
├── lib/
│   └── utils.ts               # cn() — clsx + tailwind-merge
└── styles/
    └── globals.css            # Tailwind v4, variáveis CSS, dark mode
```

## Component Catalog

### Layout & Structure
`accordion`, `aspect-ratio`, `card`, `collapsible`, `resizable`, `scroll-area`, `separator`, `tabs`, `breadcrumb`

### Navigation
`menubar`, `navigation-menu`, `pagination`, `sidebar`

### Forms & Inputs
`button`, `button-group`, `calendar`, `checkbox`, `combobox`, `cpf-cnpj-input`, `currency-input`, `field`, `form`, `input`, `input-group`, `input-otp`, `label`, `native-select`, `password-input`, `phone-input`, `radio-group`, `select`, `slider`, `switch`, `textarea`, `toggle`, `toggle-group`

### Feedback & Overlays
`alert`, `alert-dialog`, `dialog`, `drawer`, `hover-card`, `popover`, `progress`, `sheet`, `skeleton`, `tooltip`

### Data Display
`avatar`, `badge`, `carousel`, `chart`, `empty`, `item`, `kbd`, `table`

### Menus & Dropdowns
`command`, `context-menu`, `dropdown-menu`

### Special
`sonner` (toasts), `spinner`, `direction` (RTL support)

## Conventions

### Adicionando novos componentes (shadcn)

Use o CLI do shadcn a partir da raiz do monorepo:

```bash
pnpm dlx shadcn@latest add <component> --cwd packages/ui
```

Após adicionar, exporte no barrel `src/components/index.ts`.

### Criando componentes customizados

Siga o padrão dos componentes existentes:

1. **CVA para variantes:** Use `class-variance-authority` para gerenciar classes condicionais
2. **`data-slot` attribute:** Adicione em elementos raiz para targeting via CSS
3. **`React.forwardRef`:** Obrigatório para componentes de input customizados
4. **`.displayName`:** Defina após o forwardRef
5. **Compound components:** Use para componentes com múltiplas partes (ex.: Card, Field, Empty)

```typescript
// Padrão CVA
const myVariants = cva('base-classes', {
  variants: { variant: { default: '...', outline: '...' } },
  defaultVariants: { variant: 'default' },
})

// Padrão forwardRef
const MyInput = React.forwardRef<HTMLInputElement, MyInputProps>((props, ref) => {
  return <input data-slot="my-input" ref={ref} {...props} />
})
MyInput.displayName = 'MyInput'
```

### Utilitário `cn()`

Sempre use `cn()` para concatenar classes Tailwind (evita conflitos):

```typescript
import { cn } from '@workspace/ui/lib/utils'

<div className={cn('base-class', condition && 'conditional-class', className)} />
```

## Componentes Customizados Brasileiros

### `CpfCnpjInput`

Formata e valida CPF/CNPJ dinamicamente. Exporta também as funções de validação:

```typescript
import { CpfCnpjInput, validateCpf, validateCnpj, validateCpfCnpj, formatCpfCnpj } from '@workspace/ui/components/cpf-cnpj-input'

<CpfCnpjInput onChange={handleChange} onValidate={handleValidate} />
```

### `CurrencyInput`

Input monetário com prefixo R$ e formato brasileiro (`,` decimal, `.` milhar):

```typescript
import { CurrencyInput } from '@workspace/ui/components/currency-input'

<CurrencyInput value={value} onValueChange={(val) => setValue(val)} />
```

### `PhoneInput`

Seletor de país com bandeiras + input de telefone internacional:

```typescript
import { PhoneInput } from '@workspace/ui/components/phone-input'

<PhoneInput value={phone} onChange={setPhone} defaultCountry="BR" international limitMaxLength countryCallingCodeEditable={false} placeholder="Número de telefone" />
```

### `PasswordInput`

Input de senha com botão de toggle de visibilidade:

```typescript
import { PasswordInput } from '@workspace/ui/components/password-input'

<PasswordInput placeholder="Senha" {...register('password')} />
```

### `Field` / `FieldGroup`

Layout semântico para campos de formulário com suporte a orientações:

```typescript
import { FieldSet, FieldLegend, FieldGroup, Field, FieldLabel, FieldContent, FieldDescription } from '@workspace/ui/components/field'

<FieldGroup orientation="horizontal">
  <Field>
    <FieldLabel>Nome</FieldLabel>
    <FieldContent>
      <Input />
    </FieldContent>
    <FieldDescription>Texto de ajuda</FieldDescription>
  </Field>
</FieldGroup>
```

Orientações: `vertical` (padrão), `horizontal`, `responsive` (container query `@container/field-group`).

### `Empty`

Estados vazios com estrutura compound:

```typescript
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@workspace/ui/components/empty'

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><Icon /></EmptyMedia>
    <EmptyTitle>Nenhum resultado</EmptyTitle>
    <EmptyDescription>Não há itens para exibir.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Adicionar</Button>
  </EmptyContent>
</Empty>
```

## React Hook Form Integration

Use `Form` + `FormField` para formulários controlados:

```typescript
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@workspace/ui/components/form'
import { useForm } from 'react-hook-form'

const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

## Design System

### Tailwind CSS v4

O projeto usa Tailwind v4 com `@import "tailwindcss"` e `@source` directives. Não há `tailwind.config.ts` — configuração via CSS.

### Color System (OKLCH)

Variáveis CSS em espaço de cor OKLCH (`:root` + `.dark`):

| Variável | Uso |
|----------|-----|
| `--background` / `--foreground` | Fundo e texto principal |
| `--primary` / `--primary-foreground` | Cor primária e texto sobre ela |
| `--secondary` / `--secondary-foreground` | Cor secundária |
| `--muted` / `--muted-foreground` | Elementos discretos |
| `--accent` / `--accent-foreground` | Destaque de hover/focus |
| `--destructive` | Ações destrutivas |
| `--border` | Bordas |
| `--ring` | Outline de foco |
| `--chart-1` a `--chart-5` | Cores para visualizações de dados |
| `--sidebar-*` | Cores específicas da sidebar |

### Dark Mode

Ativado pela classe `.dark` no elemento pai (configurado via `next-themes`).

### Border Radius

Base: `0.625rem` (10px). Variantes: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`.

## Hooks

### `useIsMobile()`

```typescript
import { useIsMobile } from '@workspace/ui/hooks/use-mobile'

const isMobile = useIsMobile() // boolean | undefined (undefined no SSR)
```

Breakpoint: 768px. Retorna `undefined` no render inicial (SSR-safe).

/**
 * Paleta dos relatórios. Os tokens `--chart-1..5` do tema são os defaults do
 * shadcn e trocam de matiz entre claro e escuro (o azul do escuro é o laranja
 * do claro), então uma série mudaria de cor ao trocar o tema. Aqui cada série
 * tem um par de degraus escolhido para cada fundo, validado para daltonismo
 * (ΔE ≥ 8 em protanopia/deuteranopia) e contraste.
 *
 * As cores entram como custom properties num bloco `<style>` — mesmo caminho do
 * `ChartStyle` do shadcn em `packages/ui/src/components/chart.tsx`. Assim o SVG
 * lê `var(--rp-…)`, o modo escuro é resolvido pelo CSS e nada depende de o
 * Tailwind gerar utilitários a partir de strings montadas em runtime.
 */
const LIGHT: Record<string, string> = {
  'rp-inbound': '#2a78d6',
  'rp-outbound': '#eb6834',
  'rp-started': '#1baf7a',
  'rp-closed': '#eda100',
  'rp-open': '#2a78d6',
  'rp-pending': '#eb6834',
  'rp-resolved': '#1baf7a',
  'rp-heat-1': '#cde2fb',
  'rp-heat-2': '#9ec5f4',
  'rp-heat-3': '#5598e7',
  'rp-heat-4': '#2a78d6',
  'rp-heat-5': '#184f95',
}

const DARK: Record<string, string> = {
  'rp-inbound': '#3987e5',
  'rp-outbound': '#d95926',
  'rp-started': '#199e70',
  'rp-closed': '#c98500',
  'rp-open': '#3987e5',
  'rp-pending': '#d95926',
  'rp-resolved': '#199e70',
  'rp-heat-1': '#0d366b',
  'rp-heat-2': '#184f95',
  'rp-heat-3': '#256abf',
  'rp-heat-4': '#3987e5',
  'rp-heat-5': '#6da7ec',
}

/** Status não muda entre temas: os quatro degraus passam em ambos os fundos. */
const STATUS: Record<string, string> = {
  'rp-good': '#0ca30c',
  'rp-warning': '#fab219',
  'rp-critical': '#d03b3b',
}

/** Classe aplicada na raiz de cada bloco de relatório. */
export const RP_SCOPE = 'rp-palette'

const declarations = (tokens: Record<string, string>) =>
  Object.entries(tokens)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(' ')

export const paletteCss = [
  `.${RP_SCOPE} { ${declarations({ ...LIGHT, ...STATUS })} }`,
  `.dark .${RP_SCOPE} { ${declarations(DARK)} }`,
].join('\n')

export type SeriesKey = 'inbound' | 'outbound' | 'started' | 'closed'

export const SERIES_COLOR: Record<SeriesKey, string> = {
  inbound: 'var(--rp-inbound)',
  outbound: 'var(--rp-outbound)',
  started: 'var(--rp-started)',
  closed: 'var(--rp-closed)',
}

export const SERIES_LABEL: Record<SeriesKey, string> = {
  inbound: 'Recebidas',
  outbound: 'Enviadas',
  started: 'Iniciadas',
  closed: 'Fechadas',
}

export const STATUS_COLOR = {
  OPEN: 'var(--rp-open)',
  PENDING: 'var(--rp-pending)',
  CLOSED: 'var(--rp-resolved)',
} as const

/** Rampa sequencial do heatmap; o índice 0 é a célula sem volume. */
export const HEAT_STEPS = [
  'var(--rp-heat-1)',
  'var(--rp-heat-2)',
  'var(--rp-heat-3)',
  'var(--rp-heat-4)',
  'var(--rp-heat-5)',
]

export type PerformanceLevel = 'good' | 'warning' | 'critical'

export const LEVEL_COLOR: Record<PerformanceLevel, string> = {
  good: 'var(--rp-good)',
  warning: 'var(--rp-warning)',
  critical: 'var(--rp-critical)',
}

export const LEVEL_LABEL: Record<PerformanceLevel, string> = {
  good: 'Rápido',
  warning: 'Aceitável',
  critical: 'Lento',
}

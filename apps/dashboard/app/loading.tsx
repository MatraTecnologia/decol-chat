import { FullScreenLoader } from '@/components/full-screen-loader'

export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <FullScreenLoader label="Carregando..." />
    </div>
  )
}

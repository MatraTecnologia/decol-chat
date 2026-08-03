'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Plus,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { motion } from 'motion/react'
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'
import { useDebounce } from 'use-debounce'

import {
  listWhatsappTemplatesOptions,
  syncWhatsappTemplatesMutation,
} from '@workspace/api-client/react-query'

import { Button } from '@workspace/ui/components/button'
import { Skeleton } from '@workspace/ui/components/skeleton'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@workspace/ui/components/empty'

import {
  apiErrorMessage,
  DeleteTemplateDialog,
  getTemplateCapabilities,
  SubmitTemplateDialog,
  TemplateDetailsSheet,
  TemplateFilters,
  TemplateTable,
  TRANSIENT_REMOTE_STATUSES,
  type DeleteScope,
  type TemplateTarget,
} from '@/features/templates'
import { TemplateEditorDialog } from '@/features/templates/components/template-editor-dialog'
import { useUserRole } from '@/hooks'
import { invalidateByTags } from '@/lib/invalidate-by-tags'

const LIMIT = 20

/** Enquanto a Meta ainda pode mudar o veredito sozinha, a lista se atualiza. */
const POLL_INTERVAL = 30_000

type EditorMode = 'create' | 'edit' | 'duplicate'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
}

export const Client = () => {
  const queryClient = useQueryClient()
  const { role } = useUserRole()

  const { canManage } = getTemplateCapabilities(role)

  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''))
  const [category, setCategory] = useQueryState('category', parseAsString)
  const [status, setStatus] = useQueryState('status', parseAsString)
  const [language, setLanguage] = useQueryState('language', parseAsString)
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [templateId, setTemplateId] = useQueryState(
    'id',
    parseAsString.withDefault(''),
  )

  const [debouncedSearch] = useDebounce(search, 300)

  const [pollInterval, setPollInterval] = useState<number | false>(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null)

  const [submitTarget, setSubmitTarget] = useState<TemplateTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateTarget | null>(null)
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('local')

  const { data, isFetching, isPending, isError, refetch } = useQuery({
    ...listWhatsappTemplatesOptions({
      query: {
        q: debouncedSearch || undefined,
        category: category ?? undefined,
        status: status ?? undefined,
        language: language ?? undefined,
        page,
        limit: LIMIT,
      },
    }),
    refetchInterval: pollInterval,
  })

  const sync = useMutation({
    ...syncWhatsappTemplatesMutation(),
    onSuccess: result => {
      toast.success(
        `Sincronização concluída: ${result.imported} importado(s), ${result.updated} atualizado(s), ${result.failed} com falha.`,
      )
      invalidateByTags(queryClient, ['WhatsAppTemplates'])
    },
    onError: error => {
      toast.error(
        apiErrorMessage(error, 'Não foi possível sincronizar com a Meta'),
      )
    },
  })

  const templates = data?.data ?? []
  const meta = data?.meta
  const total = meta?.total ?? 0
  const totalPages = meta?.totalPages ?? 0

  // No render do servidor nada é buscado (`isFetching` é falso e `data` é
  // undefined), então só `isFetching` mandaria o estado vazio para o HTML. Já
  // com dados em mãos o skeleton não volta, senão o polling piscaria a tabela.
  const isLoading = isPending || (isFetching && !data)

  // O polling só existe enquanto houver item em estado transitório; o React
  // Query já pausa o timer com a aba em segundo plano.
  const nextPollInterval = templates.some(template =>
    TRANSIENT_REMOTE_STATUSES.includes(
      (template.remoteStatus ?? '').toUpperCase(),
    ),
  )
    ? POLL_INTERVAL
    : false

  if (nextPollInterval !== pollInterval) setPollInterval(nextPollInterval)

  const resetPage = () => setPage(1)

  const openEditor = (mode: EditorMode, id: string | null) => {
    setEditorMode(mode)
    setEditorTemplateId(id)
    setEditorOpen(true)
  }

  const openDelete = (target: TemplateTarget, scope: DeleteScope) => {
    setDeleteScope(scope)
    setDeleteTarget(target)
  }

  const rowActions = {
    onEdit: (target: TemplateTarget) => openEditor('edit', target.id),
    onDuplicate: (target: TemplateTarget) => openEditor('duplicate', target.id),
    onSubmit: setSubmitTarget,
    onDeleteDraft: (target: TemplateTarget) => openDelete(target, 'local'),
    onDeleteRemote: (target: TemplateTarget) => openDelete(target, 'remote'),
  }

  const renderCatalog = () => {
    if (isError) {
      return (
        <Empty className="border-muted-foreground/20 rounded-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert />
            </EmptyMedia>
            <EmptyTitle>Não foi possível carregar os modelos</EmptyTitle>
            <EmptyDescription>
              Verifique a conexão com o WhatsApp e tente novamente.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </Empty>
      )
    }

    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      )
    }

    if (templates.length === 0) {
      return (
        <Empty className="border-muted-foreground/20 rounded-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutTemplate />
            </EmptyMedia>
            <EmptyTitle>Nenhum modelo encontrado</EmptyTitle>
            <EmptyDescription>
              {canManage
                ? 'Crie um modelo do zero ou sincronize o catálogo já aprovado na Meta.'
                : 'Nenhum modelo corresponde aos filtros aplicados.'}
            </EmptyDescription>
          </EmptyHeader>

          {canManage && (
            <EmptyContent className="flex-row justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sync.mutate({})}
                disabled={sync.isPending}
              >
                <RefreshCw className="size-4" />
                Sincronizar
              </Button>
              <Button size="sm" onClick={() => openEditor('create', null)}>
                <Plus className="size-4" />
                Novo modelo
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )
    }

    return (
      <TemplateTable
        templates={templates}
        canManage={canManage}
        onSelect={setTemplateId}
        {...rowActions}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        variants={containerVariants}
        initial={false}
        animate="visible"
        className="space-y-6"
      >
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
              <LayoutTemplate className="text-primary size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Modelos
              </h1>
              <p className="text-muted-foreground text-sm">
                Mensagens pré-aprovadas pela Meta para iniciar conversas.
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => sync.mutate({})}
                disabled={sync.isPending}
              >
                <RefreshCw
                  className={sync.isPending ? 'size-4 animate-spin' : 'size-4'}
                />
                {sync.isPending ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
              <Button onClick={() => openEditor('create', null)}>
                <Plus className="size-4" />
                Novo modelo
              </Button>
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVariants}>
          <TemplateFilters
            search={search}
            onSearchChange={value => {
              setSearch(value)
              resetPage()
            }}
            category={category}
            onCategoryChange={value => {
              setCategory(value)
              resetPage()
            }}
            status={status}
            onStatusChange={value => {
              setStatus(value)
              resetPage()
            }}
            language={language}
            onLanguageChange={value => {
              setLanguage(value)
              resetPage()
            }}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {isLoading
                  ? 'Carregando...'
                  : `${total} modelo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
              </CardTitle>
            </CardHeader>

            <CardContent>{renderCatalog()}</CardContent>
          </Card>
        </motion.div>

        {totalPages > 1 && (
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-2"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={page === 1 || isFetching}
            >
              <ChevronLeft className="mr-1 size-4" />
              Anterior
            </Button>
            <span className="text-muted-foreground text-sm">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(current => current + 1)}
              disabled={page >= totalPages || isFetching}
            >
              Próxima
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </motion.div>
        )}
      </motion.div>

      <TemplateDetailsSheet
        templateId={templateId || null}
        canManage={canManage}
        onClose={() => setTemplateId(null)}
        {...rowActions}
      />

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={editorTemplateId}
        mode={editorMode}
      />

      <SubmitTemplateDialog
        target={submitTarget}
        onClose={() => setSubmitTarget(null)}
      />

      <DeleteTemplateDialog
        target={deleteTarget}
        scope={deleteScope}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

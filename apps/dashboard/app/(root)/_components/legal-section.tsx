export const LegalSection = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section className="space-y-3">
    <h2 className="text-foreground text-xl font-semibold tracking-tight">
      {title}
    </h2>
    <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
      {children}
    </div>
  </section>
)

export const LegalPage = ({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) => (
  <main className="mx-auto w-full max-w-3xl px-6 py-16">
    <header className="mb-12 space-y-3">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <p className="text-muted-foreground text-sm">
        Última atualização: {updatedAt}
      </p>
    </header>

    <div className="space-y-10">{children}</div>
  </main>
)

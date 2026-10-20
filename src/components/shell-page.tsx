interface ShellPageProps {
  title: string;
  description: string;
  eyebrow?: string;
}

export function ShellPage({ title, description, eyebrow = "PadhLo With Us" }: ShellPageProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
      <div className="mt-10 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">This page is being prepared.</p>
      </div>
    </section>
  );
}
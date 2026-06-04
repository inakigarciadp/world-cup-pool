import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex w-full items-center gap-1 rounded-2xl border border-border bg-surface/85 p-1 shadow-[var(--shadow-soft)]',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex h-10 flex-1 items-center justify-center rounded-xl px-3 font-heading text-sm font-extrabold text-ink-soft transition-colors outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40 data-[active]:bg-coral data-[active]:text-paper data-[active]:shadow-[0_3px_0_var(--coral-ink)] data-[selected]:bg-coral data-[selected]:text-paper data-[selected]:shadow-[0_3px_0_var(--coral-ink)] aria-selected:bg-coral aria-selected:text-paper aria-selected:shadow-[0_3px_0_var(--coral-ink)]',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn('outline-none', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

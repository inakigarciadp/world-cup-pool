import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"

function ComboboxRoot<Value, Multiple extends boolean | undefined = false>(
  props: ComboboxPrimitive.Root.Props<Value, Multiple>,
) {
  return <ComboboxPrimitive.Root {...props} />
}

function ComboboxInput({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-ring/40 transition focus:ring-3 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function ComboboxPortal(props: React.ComponentProps<typeof ComboboxPrimitive.Portal>) {
  return <ComboboxPrimitive.Portal {...props} />
}

function ComboboxPositioner({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Positioner>) {
  return <ComboboxPrimitive.Positioner className={cn("z-50 outline-none", className)} {...props} />
}

function ComboboxPopup({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Popup>) {
  return (
    <ComboboxPrimitive.Popup
      data-slot="combobox-popup"
      className={cn(
        "max-h-80 w-[var(--anchor-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        className,
      )}
      {...props}
    />
  )
}

function ComboboxList({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.List>) {
  return <ComboboxPrimitive.List className={cn("max-h-80 overflow-y-auto p-1", className)} {...props} />
}

function ComboboxItem({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "flex min-h-11 cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none data-[highlighted]:bg-muted data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function ComboboxEmpty({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return <ComboboxPrimitive.Empty className={cn("px-3 py-6 text-center text-sm text-muted-foreground", className)} {...props} />
}

export const Combobox = {
  Root: ComboboxRoot,
  Input: ComboboxInput,
  Portal: ComboboxPortal,
  Positioner: ComboboxPositioner,
  Popup: ComboboxPopup,
  List: ComboboxList,
  Item: ComboboxItem,
  Empty: ComboboxEmpty,
}

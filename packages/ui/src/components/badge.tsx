import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@crm/ui/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        mono: "rounded-sm bg-muted font-mono font-normal text-muted-foreground",
        token: "rounded-sm border-border font-normal text-foreground",
        blue: "rounded-sm bg-[#1677ff] text-white",
        navy: "rounded-sm bg-[#1d4ed8] text-white",
        orange: "rounded-sm bg-[#fa8c16] text-white",
        brown: "rounded-sm bg-[#a0522d] text-white",
        teal: "rounded-sm bg-[#13c2a3] text-white",
        green: "rounded-sm bg-[#16a34a] text-white",
        red: "rounded-sm bg-[#b91c1c] text-white",
        purple: "rounded-sm bg-[#9254de] text-white",
        gray: "rounded-sm bg-[#6b7280] text-white",
        "soft-blue": "rounded-sm bg-[#e8f1ff] text-[#1677ff]",
        "soft-orange": "rounded-sm bg-[#fff4e5] text-[#d46b08]",
        "soft-purple": "rounded-sm bg-[#f3e8ff] text-[#7e3af2]",
        "soft-green": "rounded-sm bg-[#e6f7ec] text-[#15803d]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

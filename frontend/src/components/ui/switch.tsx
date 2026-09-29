"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"
import { CheckIcon, XIcon } from "lucide-react"

interface SwitchProps extends SwitchPrimitive.Root.Props {
  /**
   * "default" — compact settings toggle.
   * "lg" — the permission-matrix toggle: a larger pill whose knob shows a check when on and a
   * cross when off, so state is readable without relying on color alone.
   */
  size?: "default" | "lg"
}

function Switch({ className, size = "default", ...props }: SwitchProps) {
  const large = size === "lg"
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary dark:bg-input/80 dark:data-checked:bg-primary",
        large ? "h-7 w-[3.25rem] bg-slate-200 dark:bg-slate-700" : "h-5 w-9",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none flex items-center justify-center rounded-full bg-background shadow-sm ring-0 transition-transform",
          large ? "size-6 data-checked:translate-x-6" : "size-4 data-checked:translate-x-4"
        )}
      >
        {large && (
          <>
            <CheckIcon
              aria-hidden
              strokeWidth={3}
              className="hidden size-3.5 text-primary-text group-data-checked/switch:block"
            />
            <XIcon
              aria-hidden
              strokeWidth={3}
              className="size-3 text-slate-400 group-data-checked/switch:hidden"
            />
          </>
        )}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }

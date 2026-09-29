"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AuthFieldProps extends Omit<ComponentProps<typeof Input>, "id"> {
  icon: LucideIcon;
  label: string;
  id: string;
}

export function AuthField({ icon: Icon, label, id, type, className, ...props }: AuthFieldProps) {
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-normal text-foreground/80">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={isPassword ? (visible ? "text" : "password") : type}
          className={cn(
            // White with a hairline border so the field stands out on the grey auth panel. The focus
            // state (1px brand border, no glow) now comes from the shared Input.
            "h-12 rounded-lg border-border bg-background pl-11 pr-4 text-[15px] shadow-none transition-colors",
            isPassword && "pr-11",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={visible ? t("hidePassword") : t("showPassword")}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

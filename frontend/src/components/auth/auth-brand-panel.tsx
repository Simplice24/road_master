import Image from "next/image";
import { useTranslations } from "next-intl";
import illustration from "@/assets/auth-illustration.png";

/**
 * The left panel of the auth screens: an inset card (4px radius, no border or shadow) showing the
 * "studying the theory" illustration above the brand title and tagline. The illustration is a PNG
 * on a white background, so the card stays white in both themes for the image to blend in.
 */
export function AuthBrandPanel() {
  const t = useTranslations("Auth");

  return (
    <div className="flex w-full flex-col items-center justify-center gap-8 overflow-hidden rounded-sm bg-white px-10 py-12 text-slate-900">
      <div className="relative min-h-0 w-full max-w-[520px] flex-1">
        <Image
          src={illustration}
          alt=""
          fill
          preload
          sizes="(min-width: 1024px) 520px, 0px"
          className="object-contain"
        />
      </div>
      <div className="max-w-[440px] text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{t("brandTitle")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{t("brandTagline")}</p>
      </div>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import {
  ArrowLeftRight,
  BookOpen,
  Gauge,
  CornerUpRight,
  Signpost,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const categoryIcons = [Signpost, ArrowLeftRight, CornerUpRight, Gauge, BookOpen];

export async function Categories() {
  const t = await getTranslations("Categories");

  const items = [1, 2, 3, 4, 5].map((n) => ({
    name: t(`cat${n}.name`),
    description: t(`cat${n}.description`),
  }));

  return (
    <section id="categories" className="bg-secondary/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const Icon = categoryIcons[index];
            const isFullyStocked = index === items.length - 1;
            return (
              <Card
                key={item.name}
                className="ring-border/80 transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    {isFullyStocked && (
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        319
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2">{item.name}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

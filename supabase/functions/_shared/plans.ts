export type PlanSlug = "basico" | "medio" | "avanzado" | "pro";

export const PLAN_PRICE_IDS: Record<PlanSlug, string> = {
  basico: "price_1TivPjEdi9JcCWjpbrX1U1jj",
  medio: "price_1TivQnEdi9JcCWjpCY5juiR3",
  avanzado: "price_1TivQTEdi9JcCWjptCpf8Eq0",
  pro: "price_1TivQ4Edi9JcCWjpOgH6hdNx",
};

export function isPlanSlug(value: string): value is PlanSlug {
  return value in PLAN_PRICE_IDS;
}

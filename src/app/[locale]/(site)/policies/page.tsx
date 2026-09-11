import { redirect } from "@/i18n/navigation";

export default async function PoliciesIndex({ params }: { params: Promise<{ locale: "en" | "ar" }> }) {
  const { locale } = await params;
  redirect({ href: "/policies/terms", locale });
}

"use client";

import { Suspense } from "react";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { TourEditor } from "@/components/admin/tour-editor";

export default function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const tour = useQuery(api.admin.products.get, isNew ? "skip" : { id: id as Id<"tours"> });
  const taxonomies = useQuery(api.admin.products.taxonomies);
  if (!taxonomies || (!isNew && tour === undefined)) return <Skeleton className="h-96 rounded-xl" />;
  if (!isNew && tour === null) return <p className="text-muted-foreground">Not found</p>;
  return (
    <Suspense fallback={null}>
      <TourEditor tour={isNew ? null : tour!} categories={taxonomies.categories} destinations={taxonomies.destinations} />
    </Suspense>
  );
}

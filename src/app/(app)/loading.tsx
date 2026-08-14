import { PageSkeleton, TopbarSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <TopbarSkeleton />
      <PageSkeleton />
    </>
  );
}

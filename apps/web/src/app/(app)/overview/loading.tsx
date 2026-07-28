import { Card, CardContent, Skeleton } from "@psh/ui";

// Next.js renders this automatically while OverviewPage's server-side fetch is in
// flight (App Router loading.tsx convention) — replaces a blank page with a shape that
// matches the real layout, so nothing jumps once data arrives.
export default function OverviewLoading() {
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-3 p-4">
              <Skeleton className="h-8 w-8 rounded-control" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

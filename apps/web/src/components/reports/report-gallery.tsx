"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@psh/ui";
import { motion } from "motion/react";
import Link from "next/link";
import { revealVariants, staggerContainer, usePrefersReducedMotion } from "../../lib/motion";
import { REPORT_CATALOG } from "./report-catalog";

export function ReportGallery() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Reports Studio</h1>
          <p className="mt-1 text-sm text-ink-muted">
            16 required reports (SRS §10.2). Filter-rich, exportable, suitable for Finance review and audit.
          </p>
        </div>
        <Link href="/reports/presets">
          <Button variant="secondary">Saved Filters</Button>
        </Link>
      </div>

      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? false : "visible"}
        variants={staggerContainer(40)}
      >
        {REPORT_CATALOG.map((entry) => (
          <motion.div key={entry.key} initial={reducedMotion ? false : "hidden"} animate={reducedMotion ? false : "visible"} variants={revealVariants}>
            {entry.implemented ? (
              <Link href={`/reports/${entry.key}`} className="block h-full">
                <Card className="h-full transition-colors hover:border-royal-400">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="neutral">{entry.key}</Badge>
                      <Badge variant="positive">Available</Badge>
                    </div>
                    <CardTitle>{entry.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-ink-muted">{entry.purpose}</p>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card className="h-full opacity-70">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="neutral">{entry.key}</Badge>
                    <Badge variant="attention">{entry.availableFrom}</Badge>
                  </div>
                  <CardTitle>{entry.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-ink-muted">{entry.purpose}</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

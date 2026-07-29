import "reflect-metadata";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";

// helmet v8 dropped Permissions-Policy support entirely (the header's directive syntax
// was never standardized, and helmet's maintainers removed it rather than guess at a
// shape) — set directly rather than mis-configure a helmet option that no longer exists.
const PERMISSIONS_POLICY = "geolocation=(), camera=(), microphone=(), payment=(), usb=()";

// Same fail-fast precedent as common.module.ts's AUTH_SECRET check — CORS_ORIGINS is
// documented in .env.example but was never actually read anywhere until now; refusing
// to boot with no explicit allowlist beats silently falling back to "no CORS" (same
// origin only, confusing to debug) or "allow everything" (a real vulnerability).
const corsOrigins = process.env.CORS_ORIGINS;
if (!corsOrigins) {
  throw new Error("CORS_ORIGINS is not set — refusing to start with no explicit CORS allowlist.");
}
const CORS_ALLOWLIST = corsOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: CORS_ALLOWLIST, credentials: true });
  app.use(
    helmet({
      // Pure JSON API, no HTML ever served — the strictest policy, not the browser-page
      // defaults helmet would otherwise merge in via useDefaults.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: { maxAge: 15_552_000, includeSubDomains: true },
      // nosniff, hidePoweredBy, etc. stay on helmet's own defaults.
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
    next();
  });
  app.use(cookieParser());
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

void bootstrap();

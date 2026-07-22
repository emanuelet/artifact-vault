import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { regenerateServiceWorker } from "./lib/service-worker.js";
import { ensureStore } from "./lib/store.js";
import { artifactRoutes } from "./routes/artifacts.js";
import { galleryRoutes } from "./routes/gallery.js";
import { manifestRoutes } from "./routes/manifest.js";

const envPath = join(import.meta.dirname, "../.env");
if (existsSync(envPath)) loadEnvFile(envPath);

declare module "fastify" {
  interface FastifyInstance {
    regenerateServiceWorker: () => Promise<void>;
  }
}

export async function buildApp(
  options: { regenerateServiceWorker?: () => Promise<void> } = {},
) {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
    bodyLimit: 11 * 1024 * 1024,
  });
  app.decorate(
    "regenerateServiceWorker",
    options.regenerateServiceWorker ?? regenerateServiceWorker,
  );

  await ensureStore();
  await app.regenerateServiceWorker();
  await app.register(fastifyStatic, {
    root: join(process.cwd(), "public"),
    prefix: "/",
    setHeaders(reply, filePath) {
      if (filePath.endsWith("/sw.js"))
        reply.header("Cache-Control", "no-cache");
    },
  });
  await app.register(galleryRoutes);
  await app.register(manifestRoutes);
  await app.register(artifactRoutes);
  return app;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 3520), host: "0.0.0.0" });
}

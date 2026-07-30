import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { hasReadAccess } from "./lib/auth.js";
import { ensureStore } from "./lib/store.js";
import { artifactRoutes } from "./routes/artifacts.js";
import { authRoutes, requiresPasskey } from "./routes/auth.js";
import { galleryRoutes } from "./routes/gallery.js";
import { manifestRoutes } from "./routes/manifest.js";

const envPath = join(import.meta.dirname, "../.env");
if (existsSync(envPath)) loadEnvFile(envPath);

export async function buildApp() {
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
	await ensureStore();
	await app.register(cookie);
	await app.register(cors, {
		origin: process.env.MOBILE_CORS_ORIGIN ?? "http://localhost",
		allowedHeaders: ["Authorization", "Content-Type"],
	});
	app.addHook("onRequest", async (request, reply) => {
		const pathname = request.url.split("?", 1)[0];
		if (
			hasReadAccess(request) &&
			(pathname === "/api/manifest" || pathname.startsWith("/artifacts/"))
		)
			return;
		if (!requiresPasskey(request)) return;
		if (request.url.startsWith("/api/"))
			return reply.code(401).send({ error: "passkey authentication required" });
		return reply.redirect("/auth");
	});
	await app.register(fastifyStatic, {
		root: join(process.cwd(), "public"),
		prefix: "/",
	});
	await app.register(authRoutes);
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

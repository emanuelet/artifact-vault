import type { FastifyInstance } from "fastify";
import { hasReadAccess } from "../lib/auth.js";
import { readManifest } from "../lib/store.js";

export async function manifestRoutes(app: FastifyInstance) {
	app.get("/api/manifest", async (request, reply) => {
		if (!hasReadAccess(request))
			return reply.code(401).send({ error: "unauthorized" });
		reply.header("Cache-Control", "no-store");
		return readManifest();
	});
}

import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { hasIngestAccess } from "../lib/auth.js";
import {
  getArtifactsDirectory,
  readManifest,
  updateManifest,
} from "../lib/store.js";
import type { Artifact } from "../lib/types.js";

const idPattern = /^[a-f0-9]{8}$/;
const maxHtmlBytes = 10 * 1024 * 1024;

interface CreateArtifactBody {
  html: string;
  title: string;
  tags?: string[];
  source?: string;
}

function isBucketUpdate(
  body: unknown,
): body is { bucket: "operational" | "understanding" } {
  return Boolean(
    body &&
    typeof body === "object" &&
    ((body as Record<string, unknown>).bucket === "operational" ||
      (body as Record<string, unknown>).bucket === "understanding"),
  );
}

function isCreateArtifactBody(body: unknown): body is CreateArtifactBody {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return (
    typeof value.html === "string" &&
    typeof value.title === "string" &&
    (value.tags === undefined ||
      (Array.isArray(value.tags) &&
        value.tags.every((tag) => typeof tag === "string"))) &&
    (value.source === undefined || typeof value.source === "string")
  );
}

function cleanText(value: string, maximumLength: number) {
  return value.trim().slice(0, maximumLength);
}

export async function artifactRoutes(app: FastifyInstance) {
  app.get("/artifacts/:id.html", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!idPattern.test(id))
      return reply.code(404).send({ error: "not found" });

    const artifact = (await readManifest()).artifacts.find(
      (item) => item.id === id,
    );
    if (!artifact) return reply.code(404).send({ error: "not found" });

    const html = await readFile(
      join(getArtifactsDirectory(), `${id}.html`),
      "utf8",
    );
    reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "public, max-age=3153 3520, immutable")
      .header(
        "Content-Security-Policy",
        "sandbox allow-scripts allow-forms allow-popups allow-downloads",
      )
      .header("X-Content-Type-Options", "nosniff");
    return html;
  });

  app.post("/api/artifacts", async (request, reply) => {
    if (!hasIngestAccess(request))
      return reply.code(401).send({ error: "unauthorized" });
    if (!isCreateArtifactBody(request.body))
      return reply.code(400).send({ error: "html and title are required" });

    const { html } = request.body;
    const title = cleanText(request.body.title, 200);
    const tags = (request.body.tags ?? [])
      .map((tag) => cleanText(tag, 50))
      .filter(Boolean)
      .slice(0, 20);
    const source = cleanText(request.body.source ?? "manual", 50) || "manual";
    if (!html || !title)
      return reply.code(400).send({ error: "html and title are required" });
    if (Buffer.byteLength(html, "utf8") > maxHtmlBytes)
      return reply.code(413).send({ error: "artifact exceeds 10 MiB limit" });

    const id = createHash("sha256").update(html).digest("hex").slice(0, 8);
    const filePath = join(getArtifactsDirectory(), `${id}.html`);
    await writeFile(filePath, html, "utf8");
    const result = await updateManifest((manifest) => {
      const existing = manifest.artifacts.find(
        (artifact) => artifact.id === id,
      );
      if (existing) return { id, status: "exists" as const };
      const artifact: Artifact = {
        id,
        title,
        tags,
        source,
        createdAt: new Date().toISOString(),
        bucket: "operational",
        sizeBytes: Buffer.byteLength(html, "utf8"),
      };
      manifest.artifacts.unshift(artifact);
      return { id, status: "created" as const };
    });

    if (result.status === "created") await app.regenerateServiceWorker();
    return result;
  });

  app.delete("/api/artifacts/:id", async (request, reply) => {
    if (!hasIngestAccess(request))
      return reply.code(401).send({ error: "unauthorized" });
    const { id } = request.params as { id: string };
    if (!idPattern.test(id))
      return reply.code(404).send({ error: "not found" });

    const deleted = await updateManifest((manifest) => {
      const index = manifest.artifacts.findIndex(
        (artifact) => artifact.id === id,
      );
      if (index === -1) return false;
      manifest.artifacts.splice(index, 1);
      return true;
    });
    if (!deleted) return reply.code(404).send({ error: "not found" });

    await rm(join(getArtifactsDirectory(), `${id}.html`), { force: true });
    await app.regenerateServiceWorker();
    return { status: "deleted" };
  });

  app.patch("/api/artifacts/:id", async (request, reply) => {
    if (!hasIngestAccess(request))
      return reply.code(401).send({ error: "unauthorized" });
    const { id } = request.params as { id: string };
    const body = request.body;
    if (!idPattern.test(id) || !isBucketUpdate(body))
      return reply.code(400).send({ error: "valid id and bucket required" });

    const updated = await updateManifest((manifest) => {
      const artifact = manifest.artifacts.find((item) => item.id === id);
      if (!artifact) return false;
      artifact.bucket = body.bucket;
      return true;
    });
    if (!updated) return reply.code(404).send({ error: "not found" });
    await app.regenerateServiceWorker();
    return { status: "updated", bucket: body.bucket };
  });
}

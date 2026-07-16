#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadEnvFile } from "node:process";

loadEnvFile(join(import.meta.dirname, "../.env"));

const vaultUrl = (process.env.VAULT_URL ?? "http://localhost: 3520").replace(
  /\/$/,
  "",
);
const vaultToken = process.env.INGEST_TOKEN;
const [command, ...arguments_] = process.argv.slice(2);

function usage() {
  console.log(
    'Usage: vault push <file.html> [--title "..."] [--tags a,b] [--source name]',
  );
  console.log("       vault list");
  console.log("       vault bucket <id> <operational|understanding>");
  console.log("       vault rm <id>");
}

function parseFlags(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--title" || flag === "--tags" || flag === "--source") {
      const value = args[++index];
      if (!value) throw new Error(`${flag} requires a value`);
      options[flag.slice(2)] = value;
    } else {
      throw new Error(`Unknown option: ${flag}`);
    }
  }
  return options;
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (vaultToken) headers.Authorization = `Bearer ${vaultToken}`;
  const response = await fetch(`${vaultUrl}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? response.statusText);
  return body;
}

async function push(filePath, options) {
  if (!vaultToken)
    throw new Error("Set INGEST_TOKEN before pushing artifacts.");
  if (!filePath) throw new Error("A file path is required.");
  const html = await readFile(filePath, "utf8");
  const title = options.title ?? basename(filePath, ".html");
  const tags = options.tags
    ? options.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  const result = await request("/api/artifacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      title,
      tags,
      source: options.source ?? "manual",
    }),
  });
  console.log(`${result.status}: ${title} (${result.id})`);
}

async function list() {
  const { artifacts } = await request("/api/manifest");
  for (const artifact of artifacts)
    console.log(
      `${artifact.id}  [${artifact.bucket}]  ${artifact.title}  (${artifact.tags.join(", ")})`,
    );
}

async function remove(id) {
  if (!vaultToken)
    throw new Error("Set INGEST_TOKEN before deleting artifacts.");
  if (!id) throw new Error("An artifact id is required.");
  await request(`/api/artifacts/${id}`, { method: "DELETE" });
  console.log(`deleted ${id}`);
}

async function setBucket(id, bucket) {
  if (!vaultToken)
    throw new Error("Set INGEST_TOKEN before updating artifacts.");
  if (!id || !["operational", "understanding"].includes(bucket))
    throw new Error("Use an artifact id and operational or understanding.");
  await request(`/api/artifacts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket }),
  });
  console.log(`${id}: ${bucket}`);
}

try {
  if (command === "push")
    await push(arguments_[0], parseFlags(arguments_.slice(1)));
  else if (command === "list") await list();
  else if (command === "rm") await remove(arguments_[0]);
  else if (command === "bucket") await setBucket(arguments_[0], arguments_[1]);
  else usage();
} catch (error) {
  console.error(
    `Failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}

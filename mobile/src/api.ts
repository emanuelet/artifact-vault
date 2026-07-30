import { getSettings } from "./storage";
import type { Manifest } from "./types";

async function request(path: string) {
	const settings = await getSettings();
	if (!settings.url || !settings.token)
		throw new Error("Set the vault URL and read token before syncing.");

	const url = new URL(path, `${settings.url.replace(/\/$/, "")}/`);
	if (!["http:", "https:"].includes(url.protocol))
		throw new Error("Vault URL must use HTTP or HTTPS.");
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${settings.token}` },
	});
	if (!response.ok)
		throw new Error(`Vault request failed: ${response.status}.`);
	return response;
}

export async function fetchManifest(): Promise<Manifest> {
	const manifest = (await (await request("/api/manifest")).json()) as Manifest;
	if (!Array.isArray(manifest.artifacts))
		throw new Error("Vault returned an invalid manifest.");
	return manifest;
}

export async function fetchArtifact(id: string) {
	return (await request(`/artifacts/${id}.html`)).text();
}

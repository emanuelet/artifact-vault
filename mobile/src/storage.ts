import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import type { Manifest, VaultSettings } from "./types";

const manifestPath = "manifest.json";
const artifactsPath = "artifacts";

export async function ensureStorage() {
	await Filesystem.mkdir({
		path: artifactsPath,
		directory: Directory.Data,
		recursive: true,
	});
}

export async function readManifest(): Promise<Manifest> {
	try {
		const { data } = await Filesystem.readFile({
			path: manifestPath,
			directory: Directory.Data,
			encoding: Encoding.UTF8,
		});
		const manifest = JSON.parse(data as string) as Manifest;
		if (!Array.isArray(manifest.artifacts))
			throw new Error("Local manifest is invalid.");
		return manifest;
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "Local manifest is invalid."
		)
			throw error;
		return { artifacts: [] };
	}
}

export async function writeManifest(manifest: Manifest) {
	await ensureStorage();
	await Filesystem.writeFile({
		path: manifestPath,
		directory: Directory.Data,
		data: JSON.stringify(manifest),
		encoding: Encoding.UTF8,
	});
}

export async function artifactExists(id: string) {
	try {
		await Filesystem.stat({
			path: `${artifactsPath}/${id}.html`,
			directory: Directory.Data,
		});
		return true;
	} catch {
		return false;
	}
}

export async function writeArtifact(id: string, html: string) {
	await ensureStorage();
	await Filesystem.writeFile({
		path: `${artifactsPath}/${id}.html`,
		directory: Directory.Data,
		data: html,
		encoding: Encoding.UTF8,
	});
}

export async function deleteArtifact(id: string) {
	try {
		await Filesystem.deleteFile({
			path: `${artifactsPath}/${id}.html`,
			directory: Directory.Data,
		});
	} catch {
		// The desired mirror state already holds when a stale file is absent.
	}
}

export async function artifactUri(id: string) {
	const { uri } = await Filesystem.getUri({
		path: `${artifactsPath}/${id}.html`,
		directory: Directory.Data,
	});
	return uri;
}

export async function getSettings(): Promise<VaultSettings> {
	const [{ value: url }, { value: token }] = await Promise.all([
		Preferences.get({ key: "vault_url" }),
		Preferences.get({ key: "vault_read_token" }),
	]);
	return { url: url ?? "", token: token ?? "" };
}

export async function saveSettings(settings: VaultSettings) {
	await Promise.all([
		Preferences.set({ key: "vault_url", value: settings.url }),
		Preferences.set({ key: "vault_read_token", value: settings.token }),
	]);
}

export async function getLastSynced() {
	return (await Preferences.get({ key: "last_synced_at" })).value;
}

export async function setLastSynced(value: string) {
	await Preferences.set({ key: "last_synced_at", value });
}

import { fetchArtifact, fetchManifest } from "./api";
import {
	artifactExists,
	deleteArtifact,
	readManifest,
	setLastSynced,
	writeArtifact,
	writeManifest,
} from "./storage";
import type { Manifest } from "./types";

export type SyncProgress = (message: string) => void;

export async function syncNow(onProgress?: SyncProgress): Promise<Manifest> {
	onProgress?.("Fetching manifest...");
	const remote = await fetchManifest();
	const local = await readManifest();
	const remoteIds = new Set(remote.artifacts.map((artifact) => artifact.id));

	for (const [index, artifact] of remote.artifacts.entries()) {
		if (await artifactExists(artifact.id)) continue;
		onProgress?.(
			`Downloading ${index + 1}/${remote.artifacts.length}: ${artifact.title}`,
		);
		await writeArtifact(artifact.id, await fetchArtifact(artifact.id));
	}

	const stale = local.artifacts.filter(
		(artifact) => !remoteIds.has(artifact.id),
	);
	for (const artifact of stale) {
		onProgress?.(`Removing ${artifact.title}`);
		await deleteArtifact(artifact.id);
	}

	await writeManifest(remote);
	await setLastSynced(new Date().toISOString());
	onProgress?.(`Synced ${remote.artifacts.length} artifact(s).`);
	return remote;
}

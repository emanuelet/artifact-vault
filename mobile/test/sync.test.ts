import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Manifest } from "../src/types";

const mocks = vi.hoisted(() => ({
	fetchManifest: vi.fn<() => Promise<Manifest>>(),
	fetchArtifact: vi.fn<(id: string) => Promise<string>>(),
	artifactExists: vi.fn<(id: string) => Promise<boolean>>(),
	deleteArtifact: vi.fn<(id: string) => Promise<void>>(),
	readManifest: vi.fn<() => Promise<Manifest>>(),
	setLastSynced: vi.fn<(value: string) => Promise<void>>(),
	writeArtifact: vi.fn<(id: string, html: string) => Promise<void>>(),
	writeManifest: vi.fn<(manifest: Manifest) => Promise<void>>(),
}));

vi.mock("../src/api", () => ({
	fetchManifest: mocks.fetchManifest,
	fetchArtifact: mocks.fetchArtifact,
}));
vi.mock("../src/storage", () => ({
	artifactExists: mocks.artifactExists,
	deleteArtifact: mocks.deleteArtifact,
	readManifest: mocks.readManifest,
	setLastSynced: mocks.setLastSynced,
	writeArtifact: mocks.writeArtifact,
	writeManifest: mocks.writeManifest,
}));

const { syncNow } = await import("../src/sync");

describe("syncNow", () => {
	const remote: Manifest = {
		artifacts: [
			{
				id: "new",
				title: "New",
				tags: [],
				source: "test",
				createdAt: "2026-07-28T00:00:00.000Z",
				bucket: "operational",
				sizeBytes: 12,
			},
		],
	};

	beforeEach(() => {
		vi.resetAllMocks();
		mocks.fetchManifest.mockResolvedValue(remote);
		mocks.readManifest.mockResolvedValue({
			artifacts: [
				{
					id: "old",
					title: "Old",
					tags: [],
					source: "test",
					createdAt: "2026-07-27T00:00:00.000Z",
					bucket: "operational",
					sizeBytes: 9,
				},
			],
		});
		mocks.artifactExists.mockResolvedValue(false);
		mocks.fetchArtifact.mockResolvedValue("<h1>New</h1>");
		mocks.writeArtifact.mockResolvedValue();
		mocks.deleteArtifact.mockResolvedValue();
		mocks.writeManifest.mockResolvedValue();
		mocks.setLastSynced.mockResolvedValue();
	});

	it("downloads missing artifacts, prunes stale files, and then saves the remote manifest", async () => {
		await syncNow();

		expect(mocks.writeArtifact).toHaveBeenCalledWith("new", "<h1>New</h1>");
		expect(mocks.deleteArtifact).toHaveBeenCalledWith("old");
		expect(mocks.writeManifest).toHaveBeenCalledWith(remote);
		expect(mocks.setLastSynced).toHaveBeenCalledOnce();
	});
});

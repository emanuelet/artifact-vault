import type { Artifact, Manifest } from "../types";

export function galleryScreen(
	manifest: Manifest,
	onOpen: (artifact: Artifact) => void,
) {
	const section = document.createElement("section");
	section.className = "gallery";
	const title = document.createElement("h2");
	title.textContent = `${manifest.artifacts.length} synced artifact${manifest.artifacts.length === 1 ? "" : "s"}`;
	section.append(title);
	const list = document.createElement("div");
	list.className = "artifact-list";
	for (const artifact of manifest.artifacts) {
		const button = document.createElement("button");
		button.className = "artifact-card";
		button.type = "button";
		const meta = document.createElement("span");
		meta.textContent = `${artifact.source} | ${new Date(artifact.createdAt).toLocaleDateString()} | ${Math.ceil(artifact.sizeBytes / 1024)} KB`;
		const heading = document.createElement("strong");
		heading.textContent = artifact.title;
		const tags = document.createElement("span");
		tags.className = "tags";
		tags.textContent = artifact.tags.join(" ");
		button.append(meta, heading, tags);
		button.addEventListener("click", () => onOpen(artifact));
		list.append(button);
	}
	if (manifest.artifacts.length === 0)
		list.textContent = "Sync while online to download artifacts.";
	section.append(list);
	return section;
}

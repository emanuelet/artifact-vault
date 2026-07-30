import { Capacitor } from "@capacitor/core";
import { artifactUri } from "../storage";
import type { Artifact } from "../types";

export async function viewerScreen(artifact: Artifact, onBack: () => void) {
	const section = document.createElement("section");
	section.className = "viewer";
	const header = document.createElement("header");
	const back = document.createElement("button");
	back.type = "button";
	back.textContent = "Back";
	back.addEventListener("click", onBack);
	const title = document.createElement("h2");
	title.textContent = artifact.title;
	header.append(back, title);
	const iframe = document.createElement("iframe");
	iframe.title = artifact.title;
	iframe.sandbox.add(
		"allow-scripts",
		"allow-forms",
		"allow-popups",
		"allow-downloads",
	);
	iframe.src = Capacitor.convertFileSrc(await artifactUri(artifact.id));
	section.append(header, iframe);
	return section;
}

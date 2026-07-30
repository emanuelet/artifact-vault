import "./style.css";
import { galleryScreen } from "./screens/gallery";
import { settingsScreen } from "./screens/settings";
import { syncStatusScreen } from "./screens/sync-status";
import { viewerScreen } from "./screens/viewer";
import { readManifest } from "./storage";
import type { Artifact } from "./types";

const root = requiredRoot();

function requiredRoot() {
	const element = document.querySelector("#app");
	if (!element) throw new Error("Missing application root.");
	return element;
}

async function renderHome() {
	root.replaceChildren();
	const header = document.createElement("header");
	header.className = "app-header";
	header.innerHTML = "<h1>Artifact Vault</h1><p>Sync once. Read anywhere.</p>";
	root.append(
		header,
		await syncStatusScreen(renderHome),
		galleryScreen(await readManifest(), renderViewer),
		await settingsScreen(renderHome),
	);
}

async function renderViewer(artifact: Artifact) {
	root.replaceChildren(await viewerScreen(artifact, renderHome));
}

void renderHome();

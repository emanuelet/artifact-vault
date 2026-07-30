import { getSettings, saveSettings } from "../storage";

export async function settingsScreen(onSaved: () => void) {
	const settings = await getSettings();
	const section = document.createElement("section");
	section.className = "settings";
	section.innerHTML = `
    <h2>Connection</h2>
    <form>
      <label>Vault URL<input name="url" type="url" required placeholder="https://vault.example.com" value="${escapeAttribute(settings.url)}" /></label>
      <label>Read token<input name="token" type="password" required autocomplete="off" value="${escapeAttribute(settings.token)}" /></label>
      <button type="submit">Save connection</button>
    </form>`;
	const form = section.querySelector("form") as HTMLFormElement;
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		const data = new FormData(form);
		const url = String(data.get("url") ?? "")
			.trim()
			.replace(/\/$/, "");
		const token = String(data.get("token") ?? "").trim();
		try {
			const parsed = new URL(url);
			if (!["http:", "https:"].includes(parsed.protocol))
				throw new Error("Use an HTTP or HTTPS URL.");
			await saveSettings({ url, token });
			onSaved();
		} catch (error) {
			showStatus(
				section,
				error instanceof Error ? error.message : "Could not save settings.",
			);
		}
	});
	return section;
}

function showStatus(section: HTMLElement, message: string) {
	let status = section.querySelector(".status") as HTMLParagraphElement | null;
	if (!status) {
		status = document.createElement("p");
		status.className = "status error";
		section.append(status);
	}
	status.textContent = message;
}

function escapeAttribute(value: string) {
	return value.replace(
		/[&<>'"]/g,
		(character) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
				character
			] as string,
	);
}

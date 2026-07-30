import { getLastSynced } from "../storage";
import { syncNow } from "../sync";

export async function syncStatusScreen(onSynced: () => void) {
	const section = document.createElement("section");
	section.className = "sync-status";
	const lastSynced = await getLastSynced();
	section.innerHTML = `<h2>Offline mirror</h2><p>${lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : "Not synced yet."}</p><button type="button">Sync now</button><p class="status" aria-live="polite"></p>`;
	const button = section.querySelector("button") as HTMLButtonElement;
	const status = section.querySelector(".status") as HTMLParagraphElement;
	button.addEventListener("click", async () => {
		button.disabled = true;
		try {
			await syncNow((message) => {
				status.textContent = message;
			});
			await onSynced();
		} catch (error) {
			status.textContent =
				error instanceof Error ? error.message : "Sync failed.";
			status.classList.add("error");
		} finally {
			button.disabled = false;
		}
	});
	return section;
}

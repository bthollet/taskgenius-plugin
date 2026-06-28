import { moment, requestUrl } from "obsidian";
import { translationManager, type SupportedLocale, type TranslationLoader } from "./manager";
import type { Translation } from "./types";
export type { TranslationKey } from "./types";

const REMOTE_BASE_URL =
	"https://raw.githubusercontent.com/Quorafind/Obsidian-Task-Progress-Bar/master/i18n";

function getPluginInstance() {
	return (window as any).app?.plugins?.plugins?.[
		"obsidian-task-progress-bar"
	];
}

function getCacheDir(): string | undefined {
	const plugin = getPluginInstance();
	if (!plugin?.manifest?.dir) return undefined;
	return `${plugin.manifest.dir}/translations`;
}

async function readLocalCache(locale: SupportedLocale): Promise<Translation | null> {
	const cacheDir = getCacheDir();
	if (!cacheDir) return null;

	const adapter = getPluginInstance()?.app?.vault?.adapter;
	if (!adapter) return null;

	const path = `${cacheDir}/${locale}.json`;
	try {
		if (await adapter.exists(path)) {
			const json = await adapter.read(path);
			return JSON.parse(json) as Translation;
		}
	} catch { /* cache miss */ }
	return null;
}

async function writeLocalCache(locale: SupportedLocale, data: Translation): Promise<void> {
	const cacheDir = getCacheDir();
	if (!cacheDir) return;

	const adapter = getPluginInstance()?.app?.vault?.adapter;
	if (!adapter) return;

	try {
		if (!(await adapter.exists(cacheDir))) {
			await adapter.mkdir(cacheDir);
		}
		await adapter.write(`${cacheDir}/${locale}.json`, JSON.stringify(data));
	} catch { /* write failure is non-fatal */ }
}

async function fetchRemoteTranslation(locale: SupportedLocale): Promise<Translation> {
	const url = `${REMOTE_BASE_URL}/${locale}.json`;
	const resp = await requestUrl({ url, method: "GET" });
	if (resp.status !== 200) {
		throw new Error(`HTTP ${resp.status} fetching ${locale} translations`);
	}
	return resp.json as Translation;
}

const loadTranslation: TranslationLoader = async (locale) => {
	if (locale === "en") {
		const cached = await readLocalCache("en");
		if (cached) return cached;

		try {
			const remote = await fetchRemoteTranslation("en");
			await writeLocalCache("en", remote);
			return remote;
		} catch {
			return {};
		}
	}

	const cached = await readLocalCache(locale);
	if (cached) {
		refreshLocaleInBackground(locale);
		return cached;
	}

	try {
		const remote = await fetchRemoteTranslation(locale);
		await writeLocalCache(locale, remote);
		return remote;
	} catch {
		throw new Error(`Failed to load ${locale} translations`);
	}
};

function refreshLocaleInBackground(locale: SupportedLocale): void {
	fetchRemoteTranslation(locale)
		.then(async (remote) => {
			await writeLocalCache(locale, remote);
			translationManager.registerTranslations(locale, remote);
		})
		.catch(() => { /* stale-while-revalidate: ignore background errors */ });
}

export async function initializeTranslations(): Promise<void> {
	const currentLocale = moment.locale();
	await translationManager.initializeLocale(currentLocale, loadTranslation);
}

export const t = translationManager.t.bind(translationManager);

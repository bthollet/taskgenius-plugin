import { moment } from "obsidian";
import type { Translation, TranslationKey, TranslationOptions } from "./types";

const SUPPORTED_LOCALES = [
	"en",
	"en-gb",
	"ja",
	"pt-br",
	"ru",
	"uk",
	"zh-cn",
	"zh-tw",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationLoader = (locale: SupportedLocale) => Promise<Translation>;

class TranslationManager {
	private static instance: TranslationManager;
	private currentLocale: SupportedLocale = "en";
	private translations: Map<string, Translation> = new Map();
	private fallbackTranslation: Translation = {};
	private lowercaseKeyMap: Map<string, Map<string, string>> = new Map();

	private constructor() {
		try {
			this.currentLocale = this.resolveLocale(moment.locale());
		} catch (error) {
			this.currentLocale = "en";
		}
	}

	public static getInstance(): TranslationManager {
		if (!TranslationManager.instance) {
			TranslationManager.instance = new TranslationManager();
		}
		return TranslationManager.instance;
	}

	public async initializeLocale(
		locale: string,
		loader: TranslationLoader,
	): Promise<void> {
		await this.loadLocale("en", loader);

		const resolvedLocale = this.resolveLocale(locale);
		if (resolvedLocale !== "en") {
			try {
				await this.loadLocale(resolvedLocale, loader);
			} catch {
				this.currentLocale = "en";
				return;
			}
		}

		this.currentLocale = resolvedLocale;
	}

	public setLocale(locale: string): void {
		this.currentLocale = this.resolveLocale(locale);
	}

	public getSupportedLocales(): SupportedLocale[] {
		return [...SUPPORTED_LOCALES];
	}

	public getResolvedLocale(): SupportedLocale {
		return this.currentLocale;
	}

	public t(key: TranslationKey, options?: TranslationOptions): string {
		const translation =
			this.translations.get(this.currentLocale) || this.fallbackTranslation;

		let result = this.getNestedValue(translation, key);

		if (!result) {
			const lowercaseKey = key.toLowerCase();
			const lowercaseMap = this.lowercaseKeyMap.get(this.currentLocale);
			const originalKey = lowercaseMap?.get(lowercaseKey);

			if (originalKey) {
				result = this.getNestedValue(translation, originalKey);
			}
		}

		if (!result) {
			result = this.getNestedValue(this.fallbackTranslation, key);

			if (!result) {
				const lowercaseKey = key.toLowerCase();
				const lowercaseMap = this.lowercaseKeyMap.get("en");
				const originalKey = lowercaseMap?.get(lowercaseKey);

				if (originalKey) {
					result = this.getNestedValue(
						this.fallbackTranslation,
						originalKey,
					);
				} else {
					result = key;
				}
			}
		}

		if (options?.interpolation) {
			result = this.interpolate(result, options.interpolation);
		}

		return result.replace(/^["""']|["""']$/g, "");
	}

	public async loadLocale(
		locale: SupportedLocale,
		loader: TranslationLoader,
	): Promise<void> {
		if (this.translations.has(locale)) {
			return;
		}

		this.registerTranslations(locale, await loader(locale));
	}

	public registerTranslations(
		locale: SupportedLocale,
		translations: Translation,
	): void {
		this.translations.set(locale, translations);
		if (locale === "en") {
			this.fallbackTranslation = translations;
		}

		const lowercaseMap = new Map<string, string>();
		Object.keys(translations).forEach((key) => {
			lowercaseMap.set(key.toLowerCase(), key);
		});
		this.lowercaseKeyMap.set(locale, lowercaseMap);
	}

	public resolveLocale(locale: string): SupportedLocale {
		const normalized = locale.toLowerCase();
		if (this.isSupportedLocale(normalized)) {
			return normalized;
		}

		if (normalized === "zh" || normalized.startsWith("zh-hans")) {
			return "zh-cn";
		}
		if (normalized.startsWith("zh-hant")) {
			return "zh-tw";
		}

		const baseLocale = normalized.split("-")[0];
		return this.isSupportedLocale(baseLocale) ? baseLocale : "en";
	}

	private isSupportedLocale(locale: string): locale is SupportedLocale {
		return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
	}

	private getNestedValue(obj: Translation, path: string): string {
		return obj[path] as string;
	}

	private interpolate(
		text: string,
		values: Record<string, string | number>,
	): string {
		return text.replace(
			/\{\{(\w+)\}\}/g,
			(_, key) => values[key]?.toString() || `{{${key}}}`,
		);
	}
}

export const translationManager = TranslationManager.getInstance();
export const t = (key: TranslationKey, options?: TranslationOptions): string =>
	translationManager.t(key, options);

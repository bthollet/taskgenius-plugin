// Fuseau force avant tout chargement de module : les workers Jest heritent de
// l'environnement du process principal. Sans cela, les tests manipulant des
// dates dependent du fuseau de la machine et la suite n'est pas reproductible.
process.env.TZ = "UTC";

const localMetadataPathIgnorePatterns = [
	"<rootDir>/.conductor/",
	"<rootDir>/.boncli/",
	"<rootDir>/.rebon/",
];

// Les suites de performance affirment des durees d'horloge murale sur un
// materiel non specifie : la grandeur mesuree n'est pas reproductible, elle ne
// peut donc pas servir de critere d'echec. Leur valeur est dans les mesures
// qu'elles journalisent, pas dans leurs assertions. Elles sont exclues de la
// suite bloquante et relancees separement par `pnpm run test:perf`.
const performanceTestPattern =
	"<rootDir>/src/__tests__/.*[Pp]erformance.*\\.test\\.ts$";
const runPerformanceTests = process.env.TG_PERF === "1";

module.exports = {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	roots: ["<rootDir>/src"],
	testMatch: ["**/__tests__/**/*.test.ts"],
	testPathIgnorePatterns: runPerformanceTests
		? localMetadataPathIgnorePatterns
		: [...localMetadataPathIgnorePatterns, performanceTestPattern],
	modulePathIgnorePatterns: localMetadataPathIgnorePatterns,
	watchPathIgnorePatterns: localMetadataPathIgnorePatterns,
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/src/__mocks__/obsidian.ts",
		"^moment$": "<rootDir>/src/__mocks__/moment.js",
		"^localforage$": "<rootDir>/src/__mocks__/localforage.ts",
		"^@codemirror/state$": "<rootDir>/src/__mocks__/codemirror-state.ts",
		"^@codemirror/view$": "<rootDir>/src/__mocks__/codemirror-view.ts",
		"^@codemirror/language$":
			"<rootDir>/src/__mocks__/codemirror-language.ts",
		"^@codemirror/search$": "<rootDir>/src/__mocks__/codemirror-search.ts",
		"^@/.*\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
		"^@/(.*)$": "<rootDir>/src/$1",
		"\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
		".*\\.worker$": "<rootDir>/src/__mocks__/ProjectData.worker.ts",
	},
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: "tsconfig.json",
			},
		],
	},
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
};

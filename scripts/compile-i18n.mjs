#!/usr/bin/env node
import fs from "fs";
import path from "path";

const LOCALE_DIR = "src/translations/locale";
const OUT_DIR = "i18n";

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const file of fs.readdirSync(LOCALE_DIR)) {
	if (!file.endsWith(".ts")) continue;

	const source = fs.readFileSync(path.join(LOCALE_DIR, file), "utf8");
	const json = source
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/^\s*const\s+translations\s*=\s*/, "")
		.replace(/;?\s*export\s+default\s+translations;?\s*$/, "");
	const translations = Function(`return (${json});`)();

	const outFile = path.join(OUT_DIR, file.replace(/\.ts$/, ".json"));
	fs.writeFileSync(outFile, JSON.stringify(translations));
	const sizeKB = (Buffer.byteLength(JSON.stringify(translations)) / 1024).toFixed(1);
	console.log(`  ${file} -> ${outFile} (${sizeKB} KB)`);
}

console.log("Done.");

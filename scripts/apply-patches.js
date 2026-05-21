const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const patchesDir = path.join(root, "patches");

if (!fs.existsSync(patchesDir)) {
	console.log("[apply-patches] No patches/ directory, skipping.");
	process.exit(0);
}

const patches = fs.readdirSync(patchesDir).filter((f) => f.endsWith(".patch"));

if (patches.length === 0) {
	console.log("[apply-patches] No patch files, skipping.");
	process.exit(0);
}

const seenPackages = new Set();

for (const patchFile of patches) {
	const pkgKey = patchFile.replace(/\.patch$/, "").replace(/[+@]\d.*$/, "");

	if (seenPackages.has(pkgKey)) {
		console.log(
			`[apply-patches] Skipping duplicate patch for ${pkgKey}: ${patchFile}`
		);
		continue;
	}

	const match = patchFile.match(/^(.+?)[+@]([^+@]+)\.patch$/);
	if (!match) {
		console.warn(`[apply-patches] Unrecognized patch filename: ${patchFile}`);
		continue;
	}

	const rawName = match[1].replace(/\+/g, "/");
	const pkgName = rawName.startsWith("@") ? rawName : rawName.replace("/", "/");
	const targetDir = path.join(root, "node_modules", pkgName);

	if (!fs.existsSync(targetDir)) {
		console.warn(
			`[apply-patches] Target package not installed, skipping: ${pkgName}`
		);
		continue;
	}

	const patchPath = path.join(patchesDir, patchFile);
	console.log(`[apply-patches] Applying ${patchFile} to ${pkgName}`);

	try {
		execFileSync(
			"git",
			[
				"apply",
				"--recount",
				"--ignore-whitespace",
				"--directory",
				`node_modules/${pkgName}`,
				patchPath,
			],
			{ cwd: root, stdio: "inherit" }
		);
		seenPackages.add(pkgKey);
	} catch (err) {
		try {
			execFileSync(
				"git",
				[
					"apply",
					"--recount",
					"--reverse",
					"--check",
					"--directory",
					`node_modules/${pkgName}`,
					patchPath,
				],
				{ cwd: root, stdio: "pipe" }
			);
			console.warn(
				`[apply-patches] Patch ${patchFile} appears to be already applied. Continuing.`
			);
		} catch (_checkErr) {
			console.error(
				`[apply-patches] Failed to apply ${patchFile}:`,
				err.message
			);
			process.exit(1);
		}
	}
}

console.log("[apply-patches] Done.");

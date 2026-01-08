// Runs Biome only on files changed in the current git branch.
// This keeps `bun run check` useful in CI without requiring repo-wide cleanup.

const { spawnSync } = require("node:child_process");

function run(command, args, options) {
	const result = spawnSync(command, args, {
		stdio: "pipe",
		encoding: "utf8",
		...options,
	});

	if (result.error) throw result.error;
	return result;
}

function getChangedFiles(baseRef) {
	const diff = run("git", [
		"diff",
		"--name-only",
		"--diff-filter=ACMRTUXB",
		`${baseRef}...HEAD`,
	]);

	if (diff.status !== 0) {
		process.stderr.write(diff.stderr || "");
		process.stdout.write(diff.stdout || "");
		process.exit(diff.status ?? 1);
	}

	return (diff.stdout || "")
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function isBiomeFile(path) {
	return /\.(js|jsx|ts|tsx|json|mjs|cjs)$/i.test(path);
}

function main() {
	const baseRef = process.env.BIOME_BASE_REF || "origin/main";

	const allChanged = getChangedFiles(baseRef);
	const biomeFiles = allChanged.filter(isBiomeFile);

	if (biomeFiles.length === 0) {
		process.stdout.write(
			`No Biome-checkable changes found (base: ${baseRef}).\n`
		);
		process.exit(0);
	}

	const args = [
		"biome",
		"check",
		"--max-diagnostics",
		"1000",
		"--reporter=summary",
		"--colors=off",
		...biomeFiles,
	];

	const result = spawnSync("bunx", args, { stdio: "inherit" });
	process.exit(result.status ?? 1);
}

main();

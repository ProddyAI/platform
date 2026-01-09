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
	const diffArgs = [
		"diff",
		"--name-only",
		"--diff-filter=ACMRTUXB",
		`${baseRef}...HEAD`,
	];

	const baseRefCheck = run("git", ["rev-parse", "--verify", `${baseRef}^{commit}`]);
	if (baseRefCheck.status !== 0) {
		// Common in shallow CI clones: origin/main isn't present locally.
		const originPrefix = "origin/";
		const remotesPrefix = "refs/remotes/origin/";
		const refName = baseRef.startsWith(originPrefix)
			? baseRef.slice(originPrefix.length)
			: baseRef.startsWith(remotesPrefix)
				? baseRef.slice(remotesPrefix.length)
				: baseRef;

		const fetch = run("git", ["fetch", "origin", refName, "--depth=1"]);
		if (fetch.status !== 0) {
			process.stderr.write(fetch.stderr || "");
			process.stdout.write(fetch.stdout || "");
			process.stderr.write(
				`\n[biome-changed] Base ref '${baseRef}' is missing and could not be fetched. ` +
					`This often happens in shallow CI clones. ` +
					`Consider setting CI fetch-depth to 0 (full history) or ensuring '${baseRef}' is fetched.\n`
			);
			process.exit(fetch.status ?? 1);
		}
	}

	const diff = run("git", diffArgs);

	if (diff.status !== 0) {
		process.stderr.write(diff.stderr || "");
		process.stdout.write(diff.stdout || "");
		process.stderr.write(
			`\n[biome-changed] Failed to compute changed files using base '${baseRef}'. ` +
				`If this is running in CI, ensure the base ref exists locally (avoid shallow clones or fetch the base ref).\n`
		);
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

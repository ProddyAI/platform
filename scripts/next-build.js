// Ensures Next.js doesn't crash trying to patch an "incorrect" package-lock.json.
// This wrapper sets the environment variable before invoking Next's CLI.

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE ||= "1";

const defaultMaxOldSpaceSize = process.platform === "win32" ? "8192" : "4096";
const maxOldSpaceSize =
	process.env.NEXT_BUILD_MAX_OLD_SPACE_SIZE || defaultMaxOldSpaceSize;

// If this wrapper is run without node flags (e.g. `node scripts/next-build.js build`),
// Next will run in the current process via `require(...)` and can hit Node's default
// ~2GB heap limit on Windows. Re-exec ourselves with the desired heap size.
if (
	process.env.NEXT_BUILD_WRAPPER_REEXEC !== "1" &&
	!process.execArgv.some((arg) => arg.startsWith("--max-old-space-size="))
) {
	const { spawnSync } = require("node:child_process");
	const result = spawnSync(
		process.execPath,
		[
			`--max-old-space-size=${maxOldSpaceSize}`,
			__filename,
			...process.argv.slice(2),
		],
		{
			stdio: "inherit",
			env: {
				...process.env,
				NEXT_BUILD_WRAPPER_REEXEC: "1",
			},
		}
	);
	process.exit(result.status ?? 1);
}

// Increase Node heap for the entire Next build (including any child Node processes)
// by setting NODE_OPTIONS, which is inherited by subprocesses.
// NOTE: `node --max-old-space-size=...` only applies to the current process.
// Next's build worker launcher strips `--max-old-space-size=...` from NODE_OPTIONS,
// so we use the underscore V8 flag variant which Node also accepts.
// Next.js currently strips `--max-old-space-size=...` from NODE_OPTIONS when spawning
// build workers, so we also set the underscore form which is still honored by Node.
const existingNodeOptions = process.env.NODE_OPTIONS || "";
const cleanedNodeOptions = existingNodeOptions
	.replace(/--max[-_]old[-_]space[-_]size=\d+/g, "")
	.trim();
process.env.NODE_OPTIONS =
	`${cleanedNodeOptions} --max_old_space_size=${maxOldSpaceSize}`.trim();

// Next's CLI reads process.argv to decide which command to run.
require("next/dist/bin/next");

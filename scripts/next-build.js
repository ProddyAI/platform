const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

async function removeIfExists(relativePath) {
	const target = path.join(root, relativePath);

	for (let attempt = 1; attempt <= 6; attempt += 1) {
		try {
			await fs.rm(target, {
				force: true,
				maxRetries: 5,
				recursive: true,
				retryDelay: 250,
			});
			return;
		} catch (error) {
			if (attempt === 6) throw error;
			await new Promise((resolve) => setTimeout(resolve, attempt * 500));
		}
	}
}

async function prepareWindowsBuild() {
	if (!isWindows) return;

	await removeIfExists(".next-win");
}

async function main() {
	await prepareWindowsBuild();

	const nextBin = path.join(
		root,
		"node_modules",
		"next",
		"dist",
		"bin",
		"next"
	);
	const env = {
		...process.env,
		NEXT_IGNORE_TS_ERRORS: "true",
		NEXT_TELEMETRY_DISABLED: "1",
	};

	if (isWindows) {
		env.LIMIT_BUILD_CPUS = "1";
		env.DISABLE_PWA_BUILD = "true";
		env.NEXT_DIST_DIR = ".next-win";
	}

	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [nextBin, "build"], {
			cwd: root,
			env,
			stdio: "inherit",
			windowsHide: true,
		});

		child.on("exit", (code, signal) => {
			if (signal) {
				process.kill(process.pid, signal);
				return;
			}

			if (code && code !== 0) {
				reject(new Error(`Next.js build failed with exit code ${code}.`));
				return;
			}

			resolve();
		});

		child.on("error", reject);
	});
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

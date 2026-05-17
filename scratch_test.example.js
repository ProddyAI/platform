const crypto = require("node:crypto");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

function verifySignature(
	payload,
	signatureHeader,
	msgId,
	timestamp,
	secretBase64
) {
	const timestampMs = Number(timestamp) * 1000;
	const toleranceMs = 5 * 60 * 1000;

	if (
		!Number.isFinite(timestampMs) ||
		Math.abs(Date.now() - timestampMs) > toleranceMs
	) {
		return false;
	}

	const toSign = `${msgId}.${timestamp}.${payload}`;
	const secretStr = secretBase64.replace("whsec_", "");
	const secretBytes = Buffer.from(secretStr, "base64");

	const computedSignature = crypto
		.createHmac("sha256", secretBytes)
		.update(toSign)
		.digest("base64");

	const signatures = signatureHeader
		.split(/[\s,]+/)
		.map((signature) => signature.trim())
		.filter(Boolean)
		.map((signature) => {
			const versionedSignature = signature.match(/^v\d+=(.+)$/i);
			return versionedSignature ? versionedSignature[1].trim() : signature;
		})
		.filter((signature) => !/^v\d+$/i.test(signature))
		.filter(Boolean);

	const computedSignatureBuffer = Buffer.from(computedSignature);

	return signatures.some((signature) => {
		const signatureBuffer = Buffer.from(signature);
		return (
			signatureBuffer.length === computedSignatureBuffer.length &&
			crypto.timingSafeEqual(signatureBuffer, computedSignatureBuffer)
		);
	});
}

function main() {
	const secret =
		process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
		process.env.STRIPE_WEBHOOK_SECRET;

	if (!secret) {
		throw new Error(
			"Missing DODO_PAYMENTS_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET in .env.local"
		);
	}

	const msgId = "msg_123";
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const payload = JSON.stringify({ type: "test" });

	const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
	const toSign = `${msgId}.${timestamp}.${payload}`;
	const sig = `v1,${crypto
		.createHmac("sha256", secretBytes)
		.update(toSign)
		.digest("base64")}`;

	process.stdout.write(
		`${verifySignature(payload, sig, msgId, timestamp, secret)}\n`
	);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error.stack || error.message || error}\n`);
	process.exit(1);
}

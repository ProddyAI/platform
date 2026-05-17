const crypto = require("node:crypto");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

async function verifySignature(
	payload,
	signatureHeader,
	msgId,
	timestamp,
	secretBase64
) {
	const toSign = `${msgId}.${timestamp}.${payload}`;
	const secretStr = secretBase64.replace("whsec_", "");
	const secretBytes = Buffer.from(secretStr, "base64");

	const computedSignature = crypto
		.createHmac("sha256", secretBytes)
		.update(toSign)
		.digest("base64");

	const signatures = signatureHeader
		.split(" ")
		.map((signature) => signature.split(",")[1])
		.filter(Boolean);

	return signatures.includes(computedSignature);
}

async function main() {
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

	console.log(await verifySignature(payload, sig, msgId, timestamp, secret));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

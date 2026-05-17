const crypto = require('crypto');

function verifySignature(payload, signatureHeader, msgId, timestamp, secretBase64) {
	const toSign = `${msgId}.${timestamp}.${payload}`;
	const secretStr = secretBase64.replace("whsec_", "");
	const secretBytes = Buffer.from(secretStr, 'base64');
	
	const hmac = crypto.createHmac('sha256', secretBytes);
	hmac.update(toSign);
	const computedSignature = hmac.digest('base64');
	
	const signatures = signatureHeader.split(" ").map(s => s.split(",")[1]);
	const computedSignatureBuffer = Buffer.from(computedSignature, "base64");
	return signatures.some((signature) => {
		if (!signature) return false;
		const signatureBuffer = Buffer.from(signature, "base64");
		return (
			signatureBuffer.length === computedSignatureBuffer.length &&
			crypto.timingSafeEqual(signatureBuffer, computedSignatureBuffer)
		);
	});
}

// simulate:
const secret = "whsec_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890=";
const msgId = "msg_123";
const timestamp = Math.floor(Date.now()/1000).toString();
const payload = '{"type":"test"}';

const secretStr = secret.replace("whsec_", "");
const secretBytes = Buffer.from(secretStr, 'base64');
const toSign = `${msgId}.${timestamp}.${payload}`;
const hmac = crypto.createHmac('sha256', secretBytes);
hmac.update(toSign);
const sig = `v1,${hmac.digest('base64')}`;

console.log(verifySignature(payload, sig, msgId, timestamp, secret));

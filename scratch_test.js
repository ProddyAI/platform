const crypto = require('crypto');

async function verifySignature(payload, signatureHeader, msgId, timestamp, secretBase64) {
	const toSign = `${msgId}.${timestamp}.${payload}`;
	const secretStr = secretBase64.replace("whsec_", "");
	const secretBytes = Buffer.from(secretStr, 'base64');
	
	const hmac = crypto.createHmac('sha256', secretBytes);
	hmac.update(toSign);
	const computedSignature = hmac.digest('base64');
	
	const signatures = signatureHeader.split(" ").map(s => s.split(",")[1]);
	return signatures.includes(computedSignature);
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

verifySignature(payload, sig, msgId, timestamp, secret).then(console.log);

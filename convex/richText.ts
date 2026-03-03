export function extractTextFromRichText(body: string): string {
	if (typeof body !== "string") return String(body);
	try {
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: { insert?: string }) =>
					typeof op.insert === "string" ? op.insert : ""
				)
				.join("")
				.trim();
		}
	} catch {
		return body.replace(/<[^>]*>/g, "").trim();
	}
	return body.trim();
}

import { format, isToday, isYesterday } from "date-fns";

export const formatFullTime = (date: Date) => {
	return `${isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMM d, yyyy")} at ${format(date, "h:mm:ss a")}`;
};

// Extract plain text from the message body using Quill
export const extractTextFromBody = (bodyJson: string): string => {
	try {
		// First try to parse the body
		const contents = JSON.parse(bodyJson);

		// If it's already a string, return it directly
		if (typeof contents === "string") {
			return contents;
		}

		// Try to extract text directly from the Delta object
		if (contents?.ops && Array.isArray(contents.ops)) {
			const text = contents.ops
				.map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
				.join("")
				.trim();

			return text;
		}

		// If we can't extract text, return an empty string
		return "";
	} catch (error) {
		console.error("Error extracting text from message body:", error);
		return "";
	}
};

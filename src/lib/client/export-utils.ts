import {
	AlignmentType,
	Document,
	HeadingLevel,
	Packer,
	Paragraph,
	TextRun,
} from "docx";
import jsPDF from "jspdf";

/** Native browser file download — no external package needed */
const saveAs = (blob: Blob, filename: string) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

interface ExportData {
	title: string;
	summary: string;
	actionItems: string[];
	decisions: string[];
	date?: string;
}

export const exportToPDF = (data: ExportData) => {
	const doc = new jsPDF();
	const margin = 20;
	let y = 20;

	// Title
	doc.setFontSize(22);
	doc.setTextColor(63, 81, 181); // Indigo
	doc.text(data.title || "Meeting Minutes", margin, y);
	y += 10;

	// Date
	doc.setFontSize(10);
	doc.setTextColor(100);
	doc.text(`Date: ${data.date || new Date().toLocaleString()}`, margin, y);
	y += 15;

	// Summary
	doc.setFontSize(16);
	doc.setTextColor(0);
	doc.text("Executive Summary", margin, y);
	y += 8;
	doc.setFontSize(11);
	const summaryLines = doc.splitTextToSize(data.summary, 170);
	doc.text(summaryLines, margin, y);
	y += summaryLines.length * 6 + 10;

	// Action Items
	if (data.actionItems.length > 0) {
		doc.setFontSize(16);
		doc.text("Action Items", margin, y);
		y += 8;
		doc.setFontSize(11);
		data.actionItems.forEach((item) => {
			const itemLines = doc.splitTextToSize(`• ${item}`, 160);
			doc.text(itemLines, margin + 5, y);
			y += itemLines.length * 6;
		});
		y += 10;
	}

	// Decisions
	if (data.decisions.length > 0) {
		doc.setFontSize(16);
		doc.text("Key Decisions", margin, y);
		y += 8;
		doc.setFontSize(11);
		data.decisions.forEach((item) => {
			const itemLines = doc.splitTextToSize(`• ${item}`, 160);
			doc.text(itemLines, margin + 5, y);
			y += itemLines.length * 6;
		});
	}

	doc.save(`${data.title.replace(/\s+/g, "_") || "Meeting_Notes"}.pdf`);
};

export const exportToWord = async (data: ExportData) => {
	const doc = new Document({
		sections: [
			{
				properties: {},
				children: [
					new Paragraph({
						text: data.title || "Meeting Minutes",
						heading: HeadingLevel.HEADING_1,
						alignment: AlignmentType.CENTER,
					}),
					new Paragraph({
						children: [
							new TextRun({
								text: `Date: ${data.date || new Date().toLocaleString()}`,
								italics: true,
								color: "666666",
							}),
						],
						spacing: { after: 400 },
					}),
					new Paragraph({
						text: "Executive Summary",
						heading: HeadingLevel.HEADING_2,
						spacing: { before: 200, after: 120 },
					}),
					new Paragraph({
						text: data.summary,
						spacing: { after: 300 },
					}),
					...(data.actionItems.length > 0
						? [
								new Paragraph({
									text: "Action Items",
									heading: HeadingLevel.HEADING_2,
									spacing: { before: 200, after: 120 },
								}),
								...data.actionItems.map(
									(item) =>
										new Paragraph({
											text: item,
											bullet: { level: 0 },
										})
								),
							]
						: []),
					...(data.decisions.length > 0
						? [
								new Paragraph({
									text: "Key Decisions",
									heading: HeadingLevel.HEADING_2,
									spacing: { before: 300, after: 120 },
								}),
								...data.decisions.map(
									(item) =>
										new Paragraph({
											text: item,
											bullet: { level: 0 },
										})
								),
							]
						: []),
				],
			},
		],
	});

	const blob = await Packer.toBlob(doc);
	saveAs(blob, `${data.title.replace(/\s+/g, "_") || "Meeting_Notes"}.docx`);
};

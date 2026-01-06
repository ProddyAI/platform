import { format } from "date-fns";
import { jsPDF } from "jspdf";

interface ExportData {
	generatedAt: string;
	timeRange: string;
	overview: any;
	messages: any;
	tasks: any;
}

interface ChartData {
	label: string;
	value: number;
}

export class PDFExporter {
	private doc: jsPDF;
	private currentY: number = 20;
	private pageHeight: number = 280;
	private margin: number = 20;

	constructor() {
		this.doc = new jsPDF();
	}

	private addTitle(title: string, fontSize: number = 16) {
		this.doc.setFontSize(fontSize);
		this.doc.setFont("helvetica", "bold");
		this.doc.text(title, this.margin, this.currentY);
		this.currentY += fontSize * 0.6;
	}

	private addSubtitle(subtitle: string, fontSize: number = 12) {
		this.doc.setFontSize(fontSize);
		this.doc.setFont("helvetica", "normal");
		this.doc.text(subtitle, this.margin, this.currentY);
		this.currentY += fontSize * 0.6;
	}

	private addText(text: string, fontSize: number = 10) {
		this.doc.setFontSize(fontSize);
		this.doc.setFont("helvetica", "normal");

		// Split text into lines that fit the page width
		const lines = this.doc.splitTextToSize(text, 170);

		// Check if we need a new page
		if (this.currentY + lines.length * fontSize * 0.4 > this.pageHeight) {
			this.addPage();
		}

		this.doc.text(lines, this.margin, this.currentY);
		this.currentY += lines.length * fontSize * 0.4;
	}

	private addSpace(space: number = 10) {
		this.currentY += space;
	}

	private addPage() {
		this.doc.addPage();
		this.currentY = 20;
	}

	private addMetricCard(
		title: string,
		value: string | number,
		description?: string,
		x?: number
	) {
		// Check if we need a new page
		if (this.currentY + 25 > this.pageHeight) {
			this.addPage();
		}

		const cardX = x || this.margin;
		const cardWidth = 85;

		// Draw a border for the metric card with subtle styling
		this.doc.setDrawColor(220, 220, 220);
		this.doc.setFillColor(248, 249, 250);
		this.doc.rect(cardX, this.currentY - 5, cardWidth, 22, "FD");

		// Add title
		this.doc.setFontSize(9);
		this.doc.setFont("helvetica", "normal");
		this.doc.setTextColor(100, 100, 100);
		this.doc.text(title, cardX + 5, this.currentY + 2);

		// Add value
		this.doc.setFontSize(16);
		this.doc.setFont("helvetica", "bold");
		this.doc.setTextColor(0, 0, 0);
		this.doc.text(String(value), cardX + 5, this.currentY + 10);

		// Add description if provided
		if (description) {
			this.doc.setFontSize(7);
			this.doc.setFont("helvetica", "normal");
			this.doc.setTextColor(120, 120, 120);
			this.doc.text(description, cardX + 5, this.currentY + 15);
		}

		// Reset text color
		this.doc.setTextColor(0, 0, 0);
	}

	private addMetricGrid(
		metrics: Array<{
			title: string;
			value: string | number;
			description?: string;
		}>
	) {
		const cardsPerRow = 2;
		const cardWidth = 85;
		const cardSpacing = 10;

		for (let i = 0; i < metrics.length; i += cardsPerRow) {
			// Check if we need a new page
			if (this.currentY + 25 > this.pageHeight) {
				this.addPage();
			}

			const rowMetrics = metrics.slice(i, i + cardsPerRow);

			rowMetrics.forEach((metric, index) => {
				const x = this.margin + index * (cardWidth + cardSpacing);
				this.addMetricCard(metric.title, metric.value, metric.description, x);
			});

			this.currentY += 30; // Move to next row
		}
	}

	private addTable(headers: string[], rows: string[][]) {
		const startY = this.currentY;
		const cellHeight = 8;
		const cellWidth = 170 / headers.length;

		// Check if table fits on current page
		if (startY + (rows.length + 1) * cellHeight > this.pageHeight) {
			this.addPage();
		}

		// Draw headers
		this.doc.setFontSize(10);
		this.doc.setFont("helvetica", "bold");
		this.doc.setFillColor(240, 240, 240);

		headers.forEach((header, index) => {
			const x = this.margin + index * cellWidth;
			this.doc.rect(x, this.currentY, cellWidth, cellHeight, "F");
			this.doc.rect(x, this.currentY, cellWidth, cellHeight);
			this.doc.text(header, x + 2, this.currentY + 5);
		});

		this.currentY += cellHeight;

		// Draw rows
		this.doc.setFont("helvetica", "normal");
		rows.forEach((row) => {
			row.forEach((cell, index) => {
				const x = this.margin + index * cellWidth;
				this.doc.rect(x, this.currentY, cellWidth, cellHeight);
				this.doc.text(String(cell), x + 2, this.currentY + 5);
			});
			this.currentY += cellHeight;
		});

		this.addSpace(10);
	}

	private addChartPlaceholder(title: string, data: ChartData[]) {
		this.addSubtitle(title);

		// Add chart data as text since we can't easily embed charts
		this.addText("Chart Data:");
		data.slice(0, 10).forEach((item) => {
			this.addText(`• ${item.label}: ${item.value}`);
		});

		if (data.length > 10) {
			this.addText(`... and ${data.length - 10} more items`);
		}

		this.addSpace(15);
	}

	public async exportReportToPDF(
		data: ExportData,
		filename?: string
	): Promise<void> {
		try {
			// Header
			this.addTitle("Reports & Analytics", 20);
			this.addSubtitle(
				`Generated on ${format(new Date(data.generatedAt), "PPP")}`,
				12
			);
			this.addSubtitle(
				`Time Range: ${this.getTimeRangeLabel(data.timeRange)}`,
				10
			);
			this.addSpace(20);

			// Overview Section
			if (data.overview) {
				this.addTitle("Overview", 16);
				this.addSpace(10);

				// Prepare overview metrics for grid layout
				const overviewMetrics = [];

				if (data.overview.totalMessages !== undefined) {
					overviewMetrics.push({
						title: "Total Messages",
						value: data.overview.totalMessages.toLocaleString(),
						description: "in selected period",
					});
				}

				if (data.overview.totalUsers !== undefined) {
					overviewMetrics.push({
						title: "Active Users",
						value: data.overview.totalUsers.toLocaleString(),
						description: "unique users",
					});
				}

				if (data.overview.totalChannels !== undefined) {
					overviewMetrics.push({
						title: "Active Channels",
						value: data.overview.totalChannels.toLocaleString(),
						description: "channels with activity",
					});
				}

				if (data.overview.averageResponseTime !== undefined) {
					overviewMetrics.push({
						title: "Avg Response Time",
						value: `${Math.round(data.overview.averageResponseTime)}min`,
						description: "average response time",
					});
				}

				// Add metrics in grid layout
				if (overviewMetrics.length > 0) {
					this.addMetricGrid(overviewMetrics);
				}

				this.addSpace(20);
			}

			// Messages Section
			if (data.messages) {
				this.addTitle("Message Analytics", 16);
				this.addSpace(10);

				// Prepare message metrics
				const messageMetrics = [];

				if (data.messages.totalMessages !== undefined) {
					messageMetrics.push({
						title: "Total Messages",
						value: data.messages.totalMessages.toLocaleString(),
						description: "in selected period",
					});
				}

				if (
					data.messages.messagesByDate &&
					data.messages.messagesByDate.length > 0
				) {
					const avgDaily = Math.round(
						data.messages.totalMessages / data.messages.messagesByDate.length
					);
					messageMetrics.push({
						title: "Daily Average",
						value: avgDaily.toLocaleString(),
						description: "messages per day",
					});
				}

				if (data.messages.topSenders && data.messages.topSenders.length > 0) {
					messageMetrics.push({
						title: "Top Sender",
						value: data.messages.topSenders[0].count.toLocaleString(),
						description: `by ${data.messages.topSenders[0].name}`,
					});
				}

				// Add metrics in grid layout
				if (messageMetrics.length > 0) {
					this.addMetricGrid(messageMetrics);
				}

				if (
					data.messages.messagesByDate &&
					data.messages.messagesByDate.length > 0
				) {
					this.addChartPlaceholder(
						"Messages Over Time",
						data.messages.messagesByDate.map((item: any) => ({
							label: format(new Date(item.date), "MMM dd"),
							value: item.count,
						}))
					);
				}

				if (data.messages.topSenders && data.messages.topSenders.length > 0) {
					this.addSubtitle("Top Message Senders");
					const senderRows = data.messages.topSenders
						.slice(0, 10)
						.map((sender: any) => [sender.name, sender.count.toString()]);
					this.addTable(["User", "Messages"], senderRows);
				}

				this.addSpace(20);
			}

			// Tasks Section
			if (data.tasks) {
				this.addTitle("Task Analytics", 16);
				this.addSpace(10);

				// Prepare task metrics
				const taskMetrics = [];

				if (data.tasks.totalTasks !== undefined) {
					taskMetrics.push({
						title: "Total Tasks",
						value: data.tasks.totalTasks.toLocaleString(),
						description: "in selected period",
					});
				}

				if (data.tasks.completedTasks !== undefined) {
					const completionRate =
						data.tasks.totalTasks > 0
							? Math.round(
									(data.tasks.completedTasks / data.tasks.totalTasks) * 100
								)
							: 0;
					taskMetrics.push({
						title: "Completed Tasks",
						value: data.tasks.completedTasks.toLocaleString(),
						description: `${completionRate}% completion rate`,
					});
				}

				if (data.tasks.statusCounts?.in_progress !== undefined) {
					taskMetrics.push({
						title: "In Progress",
						value: data.tasks.statusCounts.in_progress.toLocaleString(),
						description: "tasks in progress",
					});
				}

				if (data.tasks.priorityCounts?.high !== undefined) {
					taskMetrics.push({
						title: "High Priority",
						value: data.tasks.priorityCounts.high.toLocaleString(),
						description: "high priority tasks",
					});
				}

				// Add metrics in grid layout
				if (taskMetrics.length > 0) {
					this.addMetricGrid(taskMetrics);
				}

				if (data.tasks.statusCounts) {
					this.addSubtitle("Task Status Distribution");
					const statusRows = Object.entries(data.tasks.statusCounts).map(
						([status, count]) => [
							status.replace("_", " ").toUpperCase(),
							String(count),
						]
					);
					this.addTable(["Status", "Count"], statusRows);
				}

				this.addSpace(20);
			}

			// Footer
			this.doc.setFontSize(8);
			this.doc.setFont("helvetica", "normal");
			this.doc.text(
				`Generated by Proddy Platform on ${format(new Date(), "PPP")}`,
				this.margin,
				this.pageHeight + 10
			);

			// Save the PDF
			const fileName =
				filename || `reports-export-${format(new Date(), "yyyy-MM-dd")}.pdf`;
			this.doc.save(fileName);
		} catch (error) {
			console.error("Error generating PDF:", error);
			throw new Error("Failed to generate PDF report");
		}
	}

	private getTimeRangeLabel(timeRange: string): string {
		switch (timeRange) {
			case "1d":
				return "Last 1 day";
			case "7d":
				return "Last 7 days";
			case "30d":
				return "Last 30 days";
			default:
				return "Custom range";
		}
	}
}

export const exportReportToPDF = async (
	data: ExportData,
	filename?: string
): Promise<void> => {
	const exporter = new PDFExporter();
	await exporter.exportReportToPDF(data, filename);
};

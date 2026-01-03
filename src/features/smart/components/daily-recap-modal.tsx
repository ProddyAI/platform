'use client';

import { Sparkles, Copy, Check, X, Download, FileText, FileJson, FileOutput, File } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

interface DailyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  recap: string;
  date: string;
  messageCount: number;
  isCached?: boolean;
}

export const DailyRecapModal = ({ isOpen, onClose, recap, date, messageCount, isCached = false }: DailyRecapModalProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const formattedDate = date ? format(new Date(date), 'EEEE, MMMM d, yyyy') : '';

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(recap);
    setIsCopied(true);
    toast.success('Recap copied to clipboard');

    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([recap], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-recap-${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown');
  };

  const handleExportJSON = () => {
    const jsonData = {
      date: date,
      messageCount: messageCount,
      content: recap,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-recap-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported as JSON');
  };

  const handleExportText = () => {
    // Convert markdown to plain text (simple conversion)
    const plainText = recap
      .replace(/#{1,6}\s?([^\n]+)/g, '$1\n') // headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
      .replace(/\*([^*]+)\*/g, '$1') // italic
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // links
      .replace(/>\s?([^\n]+)/g, '  $1\n') // blockquotes
      .replace(/- ([^\n]+)/g, '• $1') // bullet points
      .replace(/\n\n/g, '\n'); // extra newlines

    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-recap-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported as Text');
  };

  const handleExportPDF = () => {
    try {
      // Create a new PDF document
      const doc = new jsPDF();

      // Set title
      const title = `Daily Recap - ${formattedDate}`;
      doc.setFontSize(16);
      doc.text(title, 20, 20);

      // Add message count info
      doc.setFontSize(10);
      doc.text(`(${messageCount} ${messageCount === 1 ? 'message' : 'messages'})`, 20, 30);

      // Convert markdown to plain text for PDF
      const plainText = recap
        .replace(/#{1,6}\s?([^\n]+)/g, '$1\n') // headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
        .replace(/\*([^*]+)\*/g, '$1') // italic
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // links
        .replace(/>\s?([^\n]+)/g, '  $1\n') // blockquotes
        .replace(/- ([^\n]+)/g, '• $1') // bullet points
        .replace(/\n\n/g, '\n'); // extra newlines

      // Add content with word wrapping
      doc.setFontSize(12);
      const splitText = doc.splitTextToSize(plainText, 170);
      doc.text(splitText, 20, 40);

      // Save the PDF
      doc.save(`daily-recap-${date}.pdf`);
      toast.success('Exported as PDF');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast.error('Failed to export as PDF');
    }
  };

  const handleExportWord = async () => {
    try {
      // Process markdown content to create document sections
      const lines = recap.split('\n');
      const paragraphs: Paragraph[] = [];

      lines.forEach((line) => {
        // Check if it's a header
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2];

          paragraphs.push(
            new Paragraph({
              text: text,
              heading: level <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            })
          );
        }
        // Check if it's a bullet point
        else if (line.match(/^- (.+)$/)) {
          const text = line.replace(/^- /, '');
          paragraphs.push(
            new Paragraph({
              text: `• ${text}`,
              bullet: { level: 0 },
            })
          );
        }
        // Regular paragraph
        else if (line.trim() !== '') {
          // Process bold and italic formatting
          const processedLine = line
            .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
            .replace(/\*([^*]+)\*/g, '$1'); // italic

          paragraphs.push(
            new Paragraph({ text: processedLine })
          );
        }
      });

      // Create a new Word document with all paragraphs
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: `Daily Recap - ${formattedDate}`,
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `(${messageCount} ${messageCount === 1 ? 'message' : 'messages'})`,
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({ text: '' }), // Empty paragraph for spacing
              ...paragraphs,
            ],
          },
        ],
      });

      // Generate the Word document
      const buffer = await Packer.toBuffer(doc);

      // Create a blob from the buffer
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-recap-${date}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Exported as Word Document');
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast.error('Failed to export as Word Document');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="relative w-full max-w-3xl rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <span>
                {isCached ? 'Cached Daily Recap' : 'Daily Recap'}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({messageCount} {messageCount === 1 ? 'message' : 'messages'})
                </span>
              </span>
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {isCached
              ? 'This recap was retrieved from cache for faster results.'
              : `AI-generated recap of conversations from ${formattedDate}.`}
          </p>
        </div>

        {/* Content */}
        <div className="mt-2 rounded-md border bg-muted/50 p-4 max-h-[60vh] overflow-y-auto">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:italic prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300">
            <ReactMarkdown>{recap}</ReactMarkdown>
          </div>
        </div>

        {/* Footer with export options */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex items-center gap-1 text-xs"
              size="sm"
            >
              {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              onClick={handleExportWord}
              variant="outline"
              className="flex items-center gap-1 text-xs"
              size="sm"
            >
              <File className="h-3 w-3" />
              Export Word
            </Button>
            <Button
              onClick={handleExportPDF}
              variant="outline"
              className="flex items-center gap-1 text-xs"
              size="sm"
            >
              <FileOutput className="h-3 w-3" />
              Export PDF
            </Button>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-xs"
            size="sm"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

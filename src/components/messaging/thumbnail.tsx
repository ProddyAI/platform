import Image from "next/image";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

interface ThumbnailProps {
	url: string | null | undefined;
}

export const Thumbnail = ({ url }: ThumbnailProps) => {
	if (!url) return null;

	const fileName = url.split("/").pop() || "attachment";

	return (
		<Dialog>
			<DialogTrigger>
				<div className="relative my-2 h-48 max-w-[360px] cursor-zoom-in overflow-hidden rounded-lg border">
					<Image
						alt={`Attachment preview: ${fileName}`}
						className="rounded-md object-cover"
						fill
						sizes="(max-width: 768px) 100vw, 360px"
						src={url}
					/>
				</div>
			</DialogTrigger>

			<DialogContent
				className="max-w-[800px] border-none bg-transparent p-0 shadow-none"
				isThumbnail
			>
				<DialogTitle className="sr-only">
					Expanded attachment preview: {fileName}
				</DialogTitle>
				<div className="relative h-[60vh] w-full">
					<Image
						alt={`Expanded attachment preview: ${fileName}`}
						className="rounded-md object-cover"
						fill
						sizes="(max-width: 1024px) 100vw, 800px"
						src={url}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
};

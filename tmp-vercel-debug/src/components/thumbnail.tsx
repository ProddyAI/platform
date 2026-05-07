import Image from "next/image";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

interface ThumbnailProps {
	url: string | null | undefined;
}

export const Thumbnail = ({ url }: ThumbnailProps) => {
	if (!url) return null;

	return (
		<Dialog>
			<DialogTrigger>
				<div className="relative my-2 max-w-[360px] cursor-zoom-in overflow-hidden rounded-lg border">
					<Image
						alt="Thumbnail preview"
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
				<div className="relative h-[60vh] w-full">
					<Image
						alt="Expanded preview"
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

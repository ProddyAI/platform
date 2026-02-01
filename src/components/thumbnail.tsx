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
					<img className="size-full rounded-md object-cover" src={url} />
				</div>
			</DialogTrigger>

			<DialogContent
				className="max-w-[800px] border-none bg-transparent p-0 shadow-none"
				isThumbnail
			>
				<img className="size-full rounded-md object-cover" src={url} />
			</DialogContent>
		</Dialog>
	);
};

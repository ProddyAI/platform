import { Loader } from "lucide-react";

// Shared loading state for dashboard widgets. Every list widget rendered this
// exact spinner block inline; centralizing it keeps the height and spinner
// consistent so widgets don't load at different sizes across the grid.
export const WidgetLoading = () => (
	<div className="flex h-[300px] items-center justify-center">
		<Loader className="size-6 animate-spin text-muted-foreground" />
	</div>
);

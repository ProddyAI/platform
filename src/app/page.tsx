import { Loader } from "lucide-react";

const IndexPage = () => {
	return (
		<div className="flex h-screen w-full items-center justify-center bg-primary">
			<div className="flex flex-col items-center gap-4 text-white">
				<Loader className="size-8 animate-spin" />
				<p className="text-lg">Redirecting...</p>
			</div>
		</div>
	);
};

export default IndexPage;

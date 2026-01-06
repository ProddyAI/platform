"use client";

import { motion, useInView } from "framer-motion";
import {
	Calendar,
	CheckSquare,
	FileText,
	LayoutGrid,
	MessageSquare,
	PaintBucket,
} from "lucide-react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

interface CapabilityCardProps {
	title: string;
	description: string;
	icon: React.ReactNode;
	delay: number;
	className?: string;
}

const CapabilityCard = ({
	title,
	description,
	icon,
	delay,
	className,
}: CapabilityCardProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-100px 0px" });

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 20 }}
			animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
			transition={{ duration: 0.5, delay: delay * 0.1 }}
			className={cn(
				"flex flex-col p-7 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300",
				"hover:border-primary/20 hover:-translate-y-1",
				className
			)}
		>
			<div className="p-4 rounded-xl bg-primary/5 w-fit mb-5">{icon}</div>
			<h3 className="text-xl font-bold mb-3 text-gray-900">{title}</h3>
			<p className="text-gray-600 leading-relaxed text-base">{description}</p>
		</motion.div>
	);
};

export const CapabilitysSection = () => {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-100px 0px" });

	return (
		<section
			id="Tools"
			className="py-16 md:py-24 bg-white relative overflow-hidden"
		>
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute bottom-[10%] -right-[5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-7xl">
				<div className="text-center mb-10">
					<motion.div
						ref={ref}
						initial={{ opacity: 0, y: 20 }}
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5 }}
						className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-secondary/10 text-secondary mb-4"
					>
						TOOLS
					</motion.div>
					<motion.h2
						initial={{ opacity: 0, y: 20 }}
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4"
					>
						Powerful Tools For <span className="text-primary">Seamless</span>{" "}
						Collaboration
					</motion.h2>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="text-lg text-gray-600 max-w-[800px] mx-auto mb-6"
					>
						Proddy's integrated tools work together to create your team's second
						brain, enhancing productivity and collaboration.
					</motion.p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
					<CapabilityCard
						title="Messaging"
						description="Real-time team communication with rich text formatting, threads, and emoji reactions for seamless collaboration."
						icon={<MessageSquare className="size-6 text-primary" />}
						delay={1}
					/>

					<CapabilityCard
						title="Canvas"
						description="Collaborative whiteboarding for brainstorming, planning, and visual collaboration with your team."
						icon={<PaintBucket className="size-6 text-primary" />}
						delay={2}
					/>

					<CapabilityCard
						title="Tasks"
						description="Organize and track work with customizable task lists, assignments, and due dates to stay on schedule."
						icon={<CheckSquare className="size-6 text-primary" />}
						delay={3}
					/>

					<CapabilityCard
						title="Boards"
						description="Visual project management with customizable boards to track progress and manage workflows efficiently."
						icon={<LayoutGrid className="size-6 text-primary" />}
						delay={4}
					/>

					<CapabilityCard
						title="Notes"
						description="Create and share rich text documents with your team for documentation, meeting notes, and knowledge sharing."
						icon={<FileText className="size-6 text-primary" />}
						delay={5}
					/>

					<CapabilityCard
						title="Calendar"
						description="Schedule and manage events, deadlines, and meetings with team-wide visibility and coordination."
						icon={<Calendar className="size-6 text-primary" />}
						delay={6}
					/>
				</div>
			</div>
		</section>
	);
};

"use client";

import { motion, useInView } from "framer-motion";
import { Check, X } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

interface ComparisonItemProps {
	title: string;
	traditional: string;
	proddy: string;
	delay: number;
}

const ComparisonItem = ({
	title,
	traditional,
	proddy,
	delay,
}: ComparisonItemProps) => {
	const itemRef = useRef<HTMLDivElement>(null);
	const isItemInView = useInView(itemRef, { once: true, margin: "-50px 0px" });

	return (
		<motion.div
			animate={isItemInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
			className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-b border-gray-200"
			initial={{ opacity: 0, y: 20 }}
			ref={itemRef}
			transition={{ duration: 0.5, delay: delay * 0.1 }}
		>
			<div className="font-medium text-gray-900">{title}</div>
			<div className="flex items-center gap-2">
				<X className="size-4 text-red-500 flex-shrink-0" />
				<span className="text-gray-600">{traditional}</span>
			</div>
			<div className="flex items-center gap-2">
				<Check className="size-4 text-green-500 flex-shrink-0" />
				<span className="text-gray-800 font-medium">{proddy}</span>
			</div>
		</motion.div>
	);
};

export const ComparisonSection = () => {
	const whySectionRef = useRef<HTMLDivElement>(null);
	const isWhySectionInView = useInView(whySectionRef, {
		once: true,
		margin: "-100px 0px",
	});

	const comparisonItems = [
		{
			title: "Tool Management",
			traditional: "Multiple disconnected tools with separate logins",
			proddy: "Single platform with integrated modules",
		},
		{
			title: "Context Switching",
			traditional: "Constant switching between apps disrupts focus",
			proddy: "Seamless workflow with everything in one place",
		},
		{
			title: "Learning Curve",
			traditional: "Multiple interfaces to learn and manage",
			proddy: "Consistent, intuitive interface across all modules",
		},
	];

	return (
		<section
			className="py-12 md:py-16 bg-white relative overflow-hidden w-full"
			id="why-proddy"
			ref={whySectionRef}
		>
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-[30%] -left-[5%] w-[25%] h-[25%] rounded-full bg-secondary/5 blur-3xl" />
				<div className="absolute bottom-[20%] -right-[10%] w-[35%] h-[35%] rounded-full bg-primary/5 blur-3xl" />
			</div>

			<div className="w-full px-6 md:px-8 relative z-10">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center max-w-7xl mx-auto">
					<div>
						<motion.div
							animate={
								isWhySectionInView
									? { opacity: 1, y: 0 }
									: { opacity: 0, y: 20 }
							}
							className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-secondary/10 text-secondary mb-3"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5 }}
						>
							WHY PRODDY?
						</motion.div>
						<motion.h2
							animate={
								isWhySectionInView
									? { opacity: 1, y: 0 }
									: { opacity: 0, y: 20 }
							}
							className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-3"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							Less Context Switching
						</motion.h2>

						<div className="bg-gray-50 rounded-lg p-4 mb-6">
							<div className="grid grid-cols-3 gap-3 mb-3 text-sm font-semibold">
								<div className="text-gray-500">Feature</div>
								<div className="text-gray-500">Traditional Tools</div>
								<div className="text-gray-500">Proddy</div>
							</div>

							{comparisonItems.map((item, index) => (
								<ComparisonItem
									delay={index + 3}
									key={index}
									proddy={item.proddy}
									title={item.title}
									traditional={item.traditional}
								/>
							))}
						</div>
					</div>

					<motion.div
						animate={
							isWhySectionInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }
						}
						className="relative"
						initial={{ opacity: 0, x: 50 }}
						transition={{ duration: 0.7, delay: 0.3 }}
					>
						<div className="relative rounded-2xl overflow-hidden shadow-2xl">
							<Image
								alt="Proddy vs Traditional Tools"
								className="w-full h-auto"
								height={700}
								src="/dashboard-preview.svg"
								width={600}
							/>

							{/* Decorative elements */}
							<div className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg">
								<Check className="size-5 text-green-500" />
							</div>
						</div>

						{/* Floating elements */}
						<div className="absolute -left-8 top-1/4 hidden lg:block">
							<div className="bg-white rounded-lg shadow-lg p-4 max-w-[200px]">
								<p className="text-sm font-medium text-gray-900 mb-1">
									Customer Quote
								</p>
								<p className="text-xs text-gray-600">
									"Switching to Proddy cut our tool costs by 40% while improving
									team collaboration."
								</p>
							</div>
						</div>

						<div className="absolute -right-8 bottom-1/4 hidden lg:block">
							<div className="bg-white rounded-lg shadow-lg p-4 max-w-[200px]">
								<div className="flex items-center gap-1 mb-2">
									{[1, 2, 3, 4, 5].map((star) => (
										<svg
											className="w-4 h-4 text-yellow-400"
											fill="currentColor"
											key={star}
											viewBox="0 0 20 20"
										>
											<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
										</svg>
									))}
								</div>
								<p className="text-xs text-gray-600">
									"4.9/5 average rating from over 1,000 teams"
								</p>
							</div>
						</div>
					</motion.div>
				</div>
			</div>
		</section>
	);
};

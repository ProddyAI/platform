"use client";

import { motion } from "framer-motion";
import { CheckCircle, Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";
import { SiFacebook, SiGithub, SiInstagram, SiX } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Footer } from "@/features/landing/components/footer";
import { Header } from "@/features/landing/components/header";

const ContactPage = () => {
	const [formState, setFormState] = useState({
		name: "",
		email: "",
		company: "",
		subject: "",
		message: "",
	});
	const [isSubmitted, setIsSubmitted] = useState(false);

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { name, value } = e.target;
		setFormState((prev) => ({ ...prev, [name]: value }));
	};

	const handleSelectChange = (value: string) => {
		setFormState((prev) => ({ ...prev, subject: value }));
	};

	const subjectLabels: Record<string, string> = {
		general: "General Inquiry",
		support: "Technical Support",
		sales: "Sales Question",
		feedback: "Feedback",
		other: "Other",
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const bodyLines = [`Name: ${formState.name}`, `Email: ${formState.email}`];
		if (formState.company) {
			bodyLines.push(`Company: ${formState.company}`);
		}
		bodyLines.push("", formState.message);

		const subject =
			subjectLabels[formState.subject] ??
			"Message from the Proddy contact form";
		const mailtoUrl = `mailto:${
			process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL
		}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
			bodyLines.join("\n")
		)}`;

		window.location.href = mailtoUrl;
		setIsSubmitted(true);
		setFormState({
			name: "",
			email: "",
			company: "",
			subject: "",
			message: "",
		});
	};

	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			{/* Hero Section */}
			<section className="py-20 bg-background">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<motion.h1
							animate={{ opacity: 1, y: 0 }}
							className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5 }}
						>
							Get in <span className="text-primary">Touch</span>
						</motion.h1>
						<motion.p
							animate={{ opacity: 1, y: 0 }}
							className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							Have questions about Proddy? We&apos;re here to help. Reach out to
							our team and we&apos;ll get back to you as soon as possible.
						</motion.p>
					</div>
				</div>
			</section>

			{/* Contact Form Section */}
			<section className="py-16 bg-muted/30">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
						{/* Contact Information */}
						<motion.div
							className="bg-card p-8 rounded-2xl shadow-sm"
							initial={{ opacity: 0, x: -20 }}
							transition={{ duration: 0.5 }}
							viewport={{ once: true }}
							whileInView={{ opacity: 1, x: 0 }}
						>
							<h2 className="text-2xl font-bold mb-6">Contact Information</h2>

							<div className="space-y-6">
								<div className="flex items-start">
									<div className="bg-primary/10 p-3 rounded-full mr-4">
										<Mail className="text-primary size-5" />
									</div>
									<div>
										<h3 className="font-medium text-foreground">Email</h3>
										<a
											className="text-primary hover:underline block mb-1"
											href={`mailto:${process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL}`}
										>
											{process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL}
										</a>
									</div>
								</div>

								<div className="flex items-start">
									<div className="bg-primary/10 p-3 rounded-full mr-4">
										<MapPin className="text-primary size-5" />
									</div>
									<div>
										<h3 className="font-medium text-foreground">Location</h3>
										<p className="text-muted-foreground">Bengaluru, India</p>
									</div>
								</div>

								<div className="flex items-start">
									<div className="bg-primary/10 p-3 rounded-full mr-4">
										<Phone className="text-primary size-5" />
									</div>
									<div>
										<h3 className="font-medium text-foreground">Phone</h3>
										<p className="text-muted-foreground">+91 (974) 609-5420</p>
									</div>
								</div>
							</div>

							<div className="mt-12">
								<h3 className="text-xl font-semibold mb-4">Follow Us</h3>
								<div className="flex space-x-4">
									<a
										className="bg-muted p-3 rounded-full hover:bg-primary/10 transition-colors"
										href="https://www.facebook.com"
										rel="noreferrer"
										target="_blank"
									>
										<span className="sr-only">Facebook</span>
										<SiFacebook
											aria-hidden="true"
											className="size-5 text-muted-foreground"
										/>
									</a>
									<a
										className="bg-muted p-3 rounded-full hover:bg-primary/10 transition-colors"
										href="https://x.com"
										rel="noreferrer"
										target="_blank"
									>
										<span className="sr-only">X</span>
										<SiX
											aria-hidden="true"
											className="size-5 text-muted-foreground"
										/>
									</a>
									<a
										className="bg-muted p-3 rounded-full hover:bg-primary/10 transition-colors"
										href="https://www.instagram.com"
										rel="noreferrer"
										target="_blank"
									>
										<span className="sr-only">Instagram</span>
										<SiInstagram
											aria-hidden="true"
											className="size-5 text-muted-foreground"
										/>
									</a>
									<a
										className="bg-muted p-3 rounded-full hover:bg-primary/10 transition-colors"
										href="https://github.com"
										rel="noreferrer"
										target="_blank"
									>
										<span className="sr-only">GitHub</span>
										<SiGithub
											aria-hidden="true"
											className="size-5 text-muted-foreground"
										/>
									</a>
								</div>
							</div>
						</motion.div>

						{/* Contact Form */}
						<motion.div
							className="bg-card p-8 rounded-2xl shadow-sm"
							initial={{ opacity: 0, x: 20 }}
							transition={{ duration: 0.5 }}
							viewport={{ once: true }}
							whileInView={{ opacity: 1, x: 0 }}
						>
							{isSubmitted ? (
								<div className="h-full flex flex-col items-center justify-center text-center py-10">
									<div className="bg-success/10 p-3 rounded-full mb-4">
										<CheckCircle className="size-10 text-success" />
									</div>
									<h2 className="text-2xl font-bold mb-4">Thank you</h2>
									<p className="text-muted-foreground mb-6">
										Your email client should now be open with your message ready
										to send. Send it from there and we&apos;ll get back to you
										as soon as possible.
									</p>
									<Button
										onClick={() => setIsSubmitted(false)}
										variant="outline"
									>
										Send Another Message
									</Button>
								</div>
							) : (
								<>
									<h2 className="text-2xl font-bold mb-6">Send Us a Message</h2>

									<form className="space-y-6" onSubmit={handleSubmit}>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div>
												<label
													className="block text-sm font-medium text-foreground mb-1"
													htmlFor="name"
												>
													Your Name
												</label>
												<Input
													id="name"
													name="name"
													onChange={handleChange}
													placeholder="John Doe"
													required
													value={formState.name}
												/>
											</div>
											<div>
												<label
													className="block text-sm font-medium text-foreground mb-1"
													htmlFor="email"
												>
													Email Address
												</label>
												<Input
													id="email"
													name="email"
													onChange={handleChange}
													placeholder="john@example.com"
													required
													type="email"
													value={formState.email}
												/>
											</div>
										</div>

										<div>
											<label
												className="block text-sm font-medium text-foreground mb-1"
												htmlFor="company"
											>
												Company (Optional)
											</label>
											<Input
												id="company"
												name="company"
												onChange={handleChange}
												placeholder="Your Company"
												value={formState.company}
											/>
										</div>

										<div>
											<label
												className="block text-sm font-medium text-foreground mb-1"
												htmlFor="subject"
											>
												Subject
											</label>
											<Select
												onValueChange={handleSelectChange}
												value={formState.subject}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select a subject" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="general">
														General Inquiry
													</SelectItem>
													<SelectItem value="support">
														Technical Support (
														{process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL})
													</SelectItem>
													<SelectItem value="sales">Sales Question</SelectItem>
													<SelectItem value="feedback">Feedback</SelectItem>
													<SelectItem value="other">Other</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div>
											<label
												className="block text-sm font-medium text-foreground mb-1"
												htmlFor="message"
											>
												Message
											</label>
											<Textarea
												id="message"
												name="message"
												onChange={handleChange}
												placeholder="How can we help you?"
												required
												rows={5}
												value={formState.message}
											/>
										</div>

										<Button
											className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
											type="submit"
										>
											<span className="flex items-center">
												<Send className="mr-2 size-4" />
												Send Message
											</span>
										</Button>
									</form>
								</>
							)}
						</motion.div>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
};

export default ContactPage;

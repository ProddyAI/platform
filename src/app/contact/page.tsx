"use client";

import { motion } from "framer-motion";
import { CheckCircle, Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";

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
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";

const ContactPage = () => {
	const [formState, setFormState] = useState({
		name: "",
		email: "",
		company: "",
		subject: "",
		message: "",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		// Simulate form submission
		setTimeout(() => {
			setIsSubmitting(false);
			setIsSubmitted(true);
			setFormState({
				name: "",
				email: "",
				company: "",
				subject: "",
				message: "",
			});
		}, 1500);
	};

	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			{/* Hero Section */}
			<section className="py-20 bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<motion.h1
							className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5 }}
						>
							Get in <span className="text-primary">Touch</span>
						</motion.h1>
						<motion.p
							className="text-xl text-gray-600 max-w-3xl mx-auto mb-10"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							Have questions about Proddy? We're here to help. Reach out to our
							team and we'll get back to you as soon as possible.
						</motion.p>
					</div>
				</div>
			</section>

			{/* Contact Form Section */}
			<section className="py-16 bg-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
						{/* Contact Information */}
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
							className="bg-white p-8 rounded-xl shadow-sm"
						>
							<h2 className="text-2xl font-bold mb-6">Contact Information</h2>

							<div className="space-y-6">
								<div className="flex items-start">
									<div className="bg-primary/10 p-3 rounded-full mr-4">
										<Mail className="text-primary h-5 w-5" />
									</div>
									<div>
										<h3 className="font-medium text-gray-900">Email</h3>
										<a
											href="mailto:support@proddy.tech"
											className="text-primary hover:underline block mb-1"
										>
											support@proddy.tech
										</a>
									</div>
								</div>

								<div className="flex items-start">
									<div className="bg-primary/10 p-3 rounded-full mr-4">
										<MapPin className="text-primary h-5 w-5" />
									</div>
									<div>
										<h3 className="font-medium text-gray-900">Location</h3>
										<p className="text-gray-600">Bengaluru, India</p>
									</div>
								</div>

								<div className="flex items-start">
									<div className="bg-primary/10 p-3 rounded-full mr-4">
										<Phone className="text-primary h-5 w-5" />
									</div>
									<div>
										<h3 className="font-medium text-gray-900">Phone</h3>
										<p className="text-gray-600">+91 (974) 609-5420</p>
									</div>
								</div>
							</div>

							<div className="mt-12">
								<h3 className="text-xl font-semibold mb-4">Follow Us</h3>
								<div className="flex space-x-4">
									<a
										href="#"
										className="bg-gray-100 p-3 rounded-full hover:bg-primary/10 transition-colors"
									>
										<svg
											className="h-5 w-5 text-gray-600"
											fill="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												fillRule="evenodd"
												d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
												clipRule="evenodd"
											/>
										</svg>
									</a>
									<a
										href="#"
										className="bg-gray-100 p-3 rounded-full hover:bg-primary/10 transition-colors"
									>
										<svg
											className="h-5 w-5 text-gray-600"
											fill="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
										</svg>
									</a>
									<a
										href="#"
										className="bg-gray-100 p-3 rounded-full hover:bg-primary/10 transition-colors"
									>
										<svg
											className="h-5 w-5 text-gray-600"
											fill="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												fillRule="evenodd"
												d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
												clipRule="evenodd"
											/>
										</svg>
									</a>
									<a
										href="#"
										className="bg-gray-100 p-3 rounded-full hover:bg-primary/10 transition-colors"
									>
										<svg
											className="h-5 w-5 text-gray-600"
											fill="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path
												fillRule="evenodd"
												d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
												clipRule="evenodd"
											/>
										</svg>
									</a>
								</div>
							</div>
						</motion.div>

						{/* Contact Form */}
						<motion.div
							initial={{ opacity: 0, x: 20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
							className="bg-white p-8 rounded-xl shadow-sm"
						>
							{isSubmitted ? (
								<div className="h-full flex flex-col items-center justify-center text-center py-10">
									<div className="bg-green-100 p-3 rounded-full mb-4">
										<CheckCircle className="h-10 w-10 text-green-600" />
									</div>
									<h2 className="text-2xl font-bold mb-4">Thank You!</h2>
									<p className="text-gray-600 mb-6">
										Your message has been sent successfully. We'll get back to
										you as soon as possible.
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

									<form onSubmit={handleSubmit} className="space-y-6">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div>
												<label
													htmlFor="name"
													className="block text-sm font-medium text-gray-700 mb-1"
												>
													Your Name
												</label>
												<Input
													id="name"
													name="name"
													value={formState.name}
													onChange={handleChange}
													placeholder="John Doe"
													required
												/>
											</div>
											<div>
												<label
													htmlFor="email"
													className="block text-sm font-medium text-gray-700 mb-1"
												>
													Email Address
												</label>
												<Input
													id="email"
													name="email"
													type="email"
													value={formState.email}
													onChange={handleChange}
													placeholder="john@example.com"
													required
												/>
											</div>
										</div>

										<div>
											<label
												htmlFor="company"
												className="block text-sm font-medium text-gray-700 mb-1"
											>
												Company (Optional)
											</label>
											<Input
												id="company"
												name="company"
												value={formState.company}
												onChange={handleChange}
												placeholder="Your Company"
											/>
										</div>

										<div>
											<label
												htmlFor="subject"
												className="block text-sm font-medium text-gray-700 mb-1"
											>
												Subject
											</label>
											<Select
												value={formState.subject}
												onValueChange={handleSelectChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select a subject" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="general">
														General Inquiry
													</SelectItem>
													<SelectItem value="support">
														Technical Support (support@proddy.tech)
													</SelectItem>
													<SelectItem value="sales">Sales Question</SelectItem>
													<SelectItem value="feedback">Feedback</SelectItem>
													<SelectItem value="other">Other</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div>
											<label
												htmlFor="message"
												className="block text-sm font-medium text-gray-700 mb-1"
											>
												Message
											</label>
											<Textarea
												id="message"
												name="message"
												value={formState.message}
												onChange={handleChange}
												placeholder="How can we help you?"
												rows={5}
												required
											/>
										</div>

										<Button
											type="submit"
											className="w-full"
											disabled={isSubmitting}
										>
											{isSubmitting ? (
												<span className="flex items-center">
													<svg
														className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
													>
														<circle
															className="opacity-25"
															cx="12"
															cy="12"
															r="10"
															stroke="currentColor"
															strokeWidth="4"
														></circle>
														<path
															className="opacity-75"
															fill="currentColor"
															d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
														></path>
													</svg>
													Sending...
												</span>
											) : (
												<span className="flex items-center">
													<Send className="mr-2 h-4 w-4" />
													Send Message
												</span>
											)}
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

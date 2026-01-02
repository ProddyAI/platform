"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  MousePointer,
  Shield,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

export const HeroSection = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1.0] as any,
      },
    },
  };

  const imageVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.7,
        ease: [0.25, 0.1, 0.25, 1.0] as any,
        delay: 0.6,
      },
    },
  };

  return (
    <section className="relative w-full pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-gradient-to-b from-white via-gray-50/50 to-gray-50">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[30%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="container px-6 md:px-8 mx-auto relative z-10 max-w-6xl">
        <motion.div
          className="flex flex-col items-center text-center"
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="mb-4">
            <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-primary/10 text-primary">
              AI-Powered Productivity Suite
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-4 max-w-4xl"
          >
            Your Team's{" "}
            <span className="text-primary relative">
              Second Brain
              <span className="absolute bottom-1 left-0 w-full h-3 bg-secondary/20 -z-10 rounded-full"></span>
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-gray-600 mb-6 max-w-[800px]"
          >
            An intelligent platform that adapts to your workflow with modular
            tools for messaging, tasks, boards, and more — all enhanced by AI.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 mb-8"
          >
            <Link href="/signup">
              <Button
                size="lg"
                className="gap-2 rounded-full shadow-md hover:shadow-lg transition-all duration-300 bg-primary hover:bg-primary/90 px-6 py-3 text-base"
              >
                Get Started <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/home#modules">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 rounded-full border-gray-300 hover:border-primary/50 px-6 py-3 text-base"
              >
                Explore Features
              </Button>
            </Link>
          </motion.div>

          <motion.div
            variants={imageVariants}
            className="relative w-full max-w-5xl"
          >
            <div className="rounded-2xl overflow-hidden shadow-xl bg-white p-2">
              <div className="relative rounded-xl overflow-hidden">
                <Image
                  src="/dashboard-preview.svg"
                  alt="Proddy Dashboard Preview"
                  width={1200}
                  height={675}
                  className="w-full h-auto"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-50"></div>
              </div>
            </div>

            {/* Floating badges - repositioned with borders */}
            {/* AI-Powered - bottom left */}
            <motion.div
              className="absolute left-[-10%] bottom-[50%] hidden md:block"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <motion.div
                className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-2 border border-primary/20"
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
              >
                <span className="text-xl">🤖</span>
                <span className="font-medium text-sm">AI-Powered</span>
              </motion.div>
            </motion.div>

            {/* Real-time - top right */}
            <motion.div
              className="absolute right-[-5%] top-[55%] hidden md:block"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <motion.div
                className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-2 border border-secondary/20"
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: 0.5,
                }}
              >
                <span className="text-xl">⚡</span>
                <span className="font-medium text-sm">Real-time</span>
              </motion.div>
            </motion.div>

            {/* Live Presence (Cursor) - top left */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 top-[25%] hidden md:block"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.5 }}
            >
              <motion.div
                className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-2 border border-primary/30"
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: 1,
                }}
              >
                <span className="text-xl flex items-center justify-center">
                  <MousePointer className="h-5 w-5 text-primary" />
                </span>
                <span className="font-medium text-sm">Live Presence</span>
              </motion.div>
            </motion.div>

            {/* Secure - bottom right */}
            <motion.div
              className="absolute right-[5%] bottom-[80%] hidden md:block"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
            >
              <motion.div
                className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-2 border border-green-200"
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: 1.5,
                }}
              >
                <span className="text-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-600" />
                </span>
                <span className="font-medium text-sm">Secure</span>
              </motion.div>
            </motion.div>

            {/* Collaborative - center middle */}
            <motion.div
              className="absolute left-[15%] top-[15%] hidden md:block"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              <motion.div
                className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-2 border border-blue-200"
                animate={{ y: [0, -10, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: 2,
                }}
              >
                <span className="text-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </span>
                <span className="font-medium text-sm">Collaborative</span>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div
            className="mt-12 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            <button
              onClick={() => {
                const element = document.getElementById('modules');
                if (element) {
                  element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                  });
                }
              }}
              className="flex flex-col items-center text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium mb-2">Discover More</span>
              <ChevronDown className="size-5 animate-bounce" />
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

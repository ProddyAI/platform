"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";

const PricingPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <HeroSection></HeroSection>

      {/* Pricing Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Free Plan */}
            <FreePlan></FreePlan>

            {/* Starter Plan */}
            <StarterPlan></StarterPlan>

            {/* Pro Plan */}
            <ProPlan></ProPlan>

            {/* Enterprise Plan */}
            <EnterprisePlan></EnterprisePlan>
          </div>
        </div>
      </section>

      {/*Comparison Table */}
      <ComparisonTable></ComparisonTable>

      {/* CTA Section */}
      <CTASection />

      <Footer />
    </div>
  );
};

export default PricingPage;

function HeroSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary mb-4"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            BETA PRICING
          </motion.div>
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Free for everyone during <span className="text-primary">beta</span>
          </motion.h1>
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="text-xl text-gray-600 max-w-3xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            All features are unlocked while we’re in beta. Pricing below shows
            planned tiers and limits for launch.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

function ComparisonTable() {
  const pricingData = [
    {
      category: "Task & Messaging Integration",
      features: [
        {
          name: "Add chat messages to tasks/calendar",
          free: "Limited",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Convert chats into tasks (with context)",
          free: "Limited",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "AI summarization of chats/tasks",
          free: "Basic (5 / month)",
          starter: "Standard (20 / month)",
          pro: "Unlimited (GPT-4)",
          enterprise: "Unlimited + custom",
        },
        {
          name: "Automated chat replies",
          free: "✕",
          starter: "Basic",
          pro: "Advanced",
          enterprise: "Full",
        },
      ],
    },
    {
      category: "AI-Powered Collaboration",
      features: [
        {
          name: "AI notes & diagramming",
          free: "Limited cleanup",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Contextual AI assistant (workspace Q&A)",
          free: "Basic bots",
          starter: "Standard models",
          pro: "GPT-4 quality",
          enterprise: "Custom agents",
        },
        {
          name: "AI workflows (create issues, emails, tasks)",
          free: "✕",
          starter: "Basic (email only)",
          pro: "Advanced",
          enterprise: "Full",
        },
      ],
    },
    {
      category: "Audio & Video Enhancements",
      features: [
        {
          name: "In-app audio calls (Notes & Canvas)",
          free: "✓",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Video calls (max resolution)",
          free: "Voice only",
          starter: "720p",
          pro: "1080p",
          enterprise: "4K+",
        },
        {
          name: "Meeting minutes/month",
          free: "2,000",
          starter: "5,000",
          pro: "Unlimited",
          enterprise: "Unlimited",
        },
      ],
    },
    {
      category: "Smart Summaries & Dashboards",
      features: [
        {
          name: "Weekly activity digest",
          free: "✓",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Custom dashboards",
          free: "Up to 3",
          starter: "Up to 10",
          pro: "Unlimited",
          enterprise: "Unlimited",
        },
        {
          name: "Dashboard widgets",
          free: "Limited",
          starter: "Standard",
          pro: "All widgets",
          enterprise: "All widgets",
        },
        {
          name: "Real-time activity feed",
          free: "✕",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
      ],
    },
    {
      category: "Views & Layouts",
      features: [
        {
          name: "Kanban / Table / Calendar views",
          free: "✓",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Gantt (timeline) view",
          free: "✕",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Unified calendar (tasks/notes/events)",
          free: "Tasks only",
          starter: "Tasks + calendar",
          pro: "All items",
          enterprise: "All items",
        },
        {
          name: "Workspace switching / invite code",
          free: "✕",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
      ],
    },
    {
      category: "Canvas & Notes",
      features: [
        {
          name: "Free-form Canvas (whiteboard)",
          free: "PNG export only",
          starter: "PNG/PDF export",
          pro: "PNG/PDF export",
          enterprise: "PNG/PDF export",
        },
        {
          name: "Real-time collaborative editing",
          free: "✓",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Enhanced notes editor",
          free: "Spellcheck only",
          starter: "AI cleanup",
          pro: "AI + formatting",
          enterprise: "AI + formatting",
        },
        {
          name: "Role-based navigation",
          free: "Admin + Member",
          starter: "Admin + Contributor",
          pro: "Full roles",
          enterprise: "Full roles + SSO",
        },
      ],
    },
    {
      category: "Integrations & Automations",
      features: [
        {
          name: "Third-party integrations (GitHub, Jira, Slack)",
          free: "Up to 2",
          starter: "Up to 5–10",
          pro: "Unlimited",
          enterprise: "Unlimited",
        },
        {
          name: "Zapier/Webhook automations",
          free: "✕",
          starter: "Basic triggers",
          pro: "Advanced flows",
          enterprise: "All workflows",
        },
        {
          name: "Shared email/chat (Gmail/Slack)",
          free: "Read-only",
          starter: "Standard",
          pro: "Full",
          enterprise: "Full + SAML SSO",
        },
      ],
    },
    {
      category: "Productivity & Mobility",
      features: [
        {
          name: "PWA / mobile access",
          free: "✓",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
        {
          name: "Offline support",
          free: "✕",
          starter: "Basic",
          pro: "Full",
          enterprise: "Full",
        },
        {
          name: "Real-time updates across devices",
          free: "✓",
          starter: "✓",
          pro: "✓",
          enterprise: "✓",
        },
      ],
    },
    {
      category: "Calendar & Scheduling",
      features: [
        {
          name: "Unified calendar integrations",
          free: "Tasks only",
          starter: "Tasks + events",
          pro: "All tools",
          enterprise: "All tools",
        },
        {
          name: "Contextual AI scheduling",
          free: "✕",
          starter: "Basic AI",
          pro: "Advanced AI",
          enterprise: "Enterprise AI",
        },
      ],
    },
    {
      category: "Limits & Capacities",
      features: [
        {
          name: "Workspaces / Projects",
          free: "1 WS, 5 projects",
          starter: "3 WS, 50 projects",
          pro: "20 WS, 200 projects",
          enterprise: "Unlimited",
        },
        {
          name: "Storage per workspace",
          free: "5 GB",
          starter: "50 GB",
          pro: "200 GB",
          enterprise: "1 TB+",
        },
        {
          name: "AI usage (monthly quota)",
          free: "Basic only",
          starter: "Limited (GPT-4/Pro)",
          pro: "High (GPT-4/Pro)",
          enterprise: "Unlimited/custom",
        },
        {
          name: "Customer support / SLA",
          free: "Community email",
          starter: "Email support",
          pro: "Priority support",
          enterprise: "Dedicated SLA",
        },
      ],
    },
    {
      category: "Security & Admin (additional)",
      features: [
        {
          name: "Role-based access & permissions",
          free: "Basic roles",
          starter: "Admin + Contributor",
          pro: "Granular",
          enterprise: "Granular + custom policies",
        },
        {
          name: "Audit logs & exports",
          free: "✕",
          starter: "Basic",
          pro: "Advanced",
          enterprise: "Enterprise-grade",
        },
        {
          name: "Data residency & retention controls",
          free: "✕",
          starter: "✕",
          pro: "Optional",
          enterprise: "Custom",
        },
      ],
    },
  ];
  return (
    <section className="py-16 bg-white" id="comparison">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h2 className="text-3xl font-semibold text-gray-900">
            Full feature comparison
          </h2>
          <p className="text-gray-600 mt-3">
            A detailed breakdown by category, with limits and availability per
            tier.
          </p>
        </div>
        <div className="space-y-8">
          <div className="overflow-x-auto border border-gray-100 rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="py-4 px-4 text-left font-medium">Feature</th>
                  <th className="py-4 px-4 text-left font-medium">Free</th>
                  <th className="py-4 px-4 text-left font-medium">Starter</th>
                  <th className="py-4 px-4 text-left font-medium">Pro</th>
                  <th className="py-4 px-4 text-left font-medium">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {pricingData.map((section, sectionIndex) => (
                  <Fragment key={sectionIndex}>
                    {/* Category header row */}
                    <tr className="bg-gray-50">
                      <td className="py-3 px-4 font-semibold" colSpan={5}>
                        {section.category}
                      </td>
                    </tr>

                    {/* Feature rows */}
                    {section.features.map((feature, featureIndex) => (
                      <tr
                        key={featureIndex}
                        className="border-b border-gray-100"
                      >
                        <td className="py-3 px-4">{feature.name}</td>
                        <td className="py-3 px-4">{feature.free}</td>
                        <td className="py-3 px-4">{feature.starter}</td>
                        <td className="py-3 px-4">{feature.pro}</td>
                        <td className="py-3 px-4">{feature.enterprise}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function FreePlan() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <h3 className="text-lg font-semibold mb-2">Free</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold">$0</span>
        <span className="text-gray-500 ml-2">/user/month</span>
      </div>
      <p className="text-gray-600 mb-6">
        Core tasks, notes, and messaging for individuals and small teams.
      </p>
      <ul className="space-y-3 mb-8">
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Unlimited users</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">~5 GB total storage</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Up to 2 integrations</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Basic AI summaries (5 / month)</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">1:1 voice calls only</span>
        </li>
      </ul>
      <Link href="/auth/signup">
        <Button className="w-full">
          Get Started <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </motion.div>
  );
}

function StarterPlan() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <h3 className="text-lg font-semibold mb-2">Starter</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold">$5</span>
        <span className="text-gray-500 ml-2">/user/month</span>
        <span className="text-xs text-gray-500 ml-2">billed annually</span>
      </div>
      <p className="text-gray-600 mb-6">
        Everything in Free, plus team workspaces and more storage.
      </p>
      <ul className="space-y-3 mb-8">
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Unlimited tasks & projects</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">10–20 GB storage per user</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Up to 5–10 integrations</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Basic AI summaries (20 / month)</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Group calls up to 720p</span>
        </li>
      </ul>
      <Button className="w-full" disabled variant="outline">
        Available after beta
      </Button>
    </motion.div>
  );
}

function ProPlan() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm p-8 border border-primary/20 relative ring-1 ring-primary/20"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <h3 className="text-lg font-semibold mb-2">Pro</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold">$12</span>
        <span className="text-gray-500 ml-2">/user/month</span>
        <span className="text-xs text-gray-500 ml-2">billed annually</span>
      </div>
      <p className="text-gray-600 mb-6">
        Advanced AI and security controls for growing teams.
      </p>
      <ul className="space-y-3 mb-8">
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Unlimited storage</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Unlimited integrations</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Unlimited GPT-4 summaries & Q&A</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">HD video calls (1080p)</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">SAML SSO + granular permissions</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Priority support</span>
        </li>
      </ul>
      <Button className="w-full" disabled>
        Available after beta
      </Button>
    </motion.div>
  );
}

function EnterprisePlan() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <h3 className="text-lg font-semibold mb-2">Enterprise</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold">Custom</span>
        <span className="text-gray-500 ml-2">/quote</span>
      </div>
      <p className="text-gray-600 mb-6">
        Enterprise controls, compliance, and dedicated support.
      </p>
      <ul className="space-y-3 mb-8">
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Unlimited teams & workspaces</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">SCIM & SAML SSO</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Data residency & custom SLAs</span>
        </li>
        <li className="flex items-start">
          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700">Dedicated account management</span>
        </li>
      </ul>
      <Link href="/contact">
        <Button className="w-full" variant="outline">
          Contact Sales
        </Button>
      </Link>
    </motion.div>
  );
}

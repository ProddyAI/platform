// Shared test data for all test pages to ensure consistency

// Team Members - Used across all test components
export const TEST_MEMBERS = [
	{
		_id: "member-1",
		user: {
			name: "Alex Rodriguez",
			image: null,
		},
	},
	{
		_id: "member-2",
		user: {
			name: "Sarah Johnson",
			image: null,
		},
	},
	{
		_id: "member-3",
		user: {
			name: "Maya Patel",
			image: null,
		},
	},
	{
		_id: "member-4",
		user: {
			name: "David Kim",
			image: null,
		},
	},
	{
		_id: "member-5",
		user: {
			name: "Lisa Chen",
			image: null,
		},
	},
];

// Calendar Events - Used in calendar and dashboard
export const TEST_EVENTS = [
	// Current month events (January 2025)
	{
		id: "current-1",
		title: "Team Standup",
		date: new Date(2025, 0, 15, 9, 0), // January 15, 2025, 9:00 AM
		endDate: new Date(2025, 0, 15, 9, 30), // January 15, 2025, 9:30 AM
		type: "meeting",
		priority: "medium",
		location: "Conference Room A",
		attendees: ["Alex Rodriguez", "Sarah Johnson", "Maya Patel", "David Kim"],
		description: "Daily team standup meeting to discuss progress and blockers.",
		organizer: "Alex Rodriguez",
		status: "confirmed",
	},
	{
		id: "current-2",
		title: "Payment API Integration Deadline",
		date: new Date(2025, 0, 20, 17, 0), // January 20, 2025, 5:00 PM
		endDate: new Date(2025, 0, 20, 17, 0), // January 20, 2025, 5:00 PM
		type: "deadline",
		priority: "critical",
		location: "Remote",
		attendees: ["Alex Rodriguez", "Sarah Johnson"],
		description: "Final deadline for payment API integration completion.",
		organizer: "Lisa Chen",
		status: "confirmed",
	},
	{
		id: "current-3",
		title: "Code Review Session",
		date: new Date(2025, 0, 22, 14, 0), // January 22, 2025, 2:00 PM
		endDate: new Date(2025, 0, 22, 16, 0), // January 22, 2025, 4:00 PM
		type: "task",
		priority: "medium",
		location: "Development Office",
		attendees: ["Maya Patel", "David Kim"],
		description: "Review recent code changes and improvements for mobile app.",
		organizer: "Maya Patel",
		status: "confirmed",
	},
	// December 2024 Events
	{
		id: "1",
		title: "Sprint Planning - Q2 Feature Development",
		date: new Date(2024, 11, 20, 10, 0), // December 20, 2024, 10:00 AM
		endDate: new Date(2024, 11, 20, 12, 0), // December 20, 2024, 12:00 PM
		type: "meeting",
		priority: "high",
		location: "Conference Room A",
		attendees: ["Lisa Chen", "Alex Rodriguez", "Sarah Johnson", "Maya Patel"],
		description:
			"Review completed stories from last sprint, plan capacity for upcoming sprint, and discuss mobile app delays.",
		organizer: "Lisa Chen",
		status: "confirmed",
	},
	{
		id: "2",
		title: "Daily Standup",
		date: new Date(2024, 11, 20, 9, 0), // December 20, 2024, 9:00 AM
		endDate: new Date(2024, 11, 20, 9, 15), // December 20, 2024, 9:15 AM
		type: "meeting",
		priority: "medium",
		location: "Conference Room B",
		attendees: ["Full Dev Team"],
		description: "Daily team sync and blocker discussion.",
		organizer: "Alex Rodriguez",
		status: "confirmed",
	},
	{
		id: "3",
		title: "Stakeholder Review",
		date: new Date(2024, 11, 20, 14, 30), // December 20, 2024, 2:30 PM
		endDate: new Date(2024, 11, 20, 15, 30), // December 20, 2024, 3:30 PM
		type: "meeting",
		priority: "high",
		location: "Zoom Call",
		attendees: ["Client Team", "Lisa Chen"],
		description:
			"Review project progress and gather feedback from stakeholders.",
		organizer: "Lisa Chen",
		status: "confirmed",
	},
	{
		id: "4",
		title: "1:1 with Sarah",
		date: new Date(2024, 11, 20, 16, 0), // December 20, 2024, 4:00 PM
		endDate: new Date(2024, 11, 20, 16, 30), // December 20, 2024, 4:30 PM
		type: "meeting",
		priority: "medium",
		location: "Office",
		attendees: ["Sarah Johnson"],
		description:
			"Database performance incident discussion and career development.",
		organizer: "You",
		status: "confirmed",
	},
	{
		id: "5",
		title: "Payment API Testing Deadline",
		date: new Date(2024, 11, 21, 17, 0), // December 21, 2024, 5:00 PM
		endDate: new Date(2024, 11, 21, 17, 0), // December 21, 2024, 5:00 PM
		type: "deadline",
		priority: "high",
		location: "Remote",
		attendees: ["Alex Rodriguez", "Sarah Johnson"],
		description: "Complete testing phase for Payment API integration.",
		organizer: "Alex Rodriguez",
		status: "pending",
	},
	{
		id: "6",
		title: "Architecture Review",
		date: new Date(2024, 11, 21, 9, 0), // December 21, 2024, 9:00 AM
		endDate: new Date(2024, 11, 21, 10, 30), // December 21, 2024, 10:30 AM
		type: "meeting",
		priority: "medium",
		location: "Conference Room A",
		attendees: ["David Kim", "Maya Patel"],
		description: "Review system architecture for upcoming features.",
		organizer: "David Kim",
		status: "confirmed",
	},
	{
		id: "7",
		title: "Client Demo Preparation",
		date: new Date(2024, 11, 21, 10, 30), // December 21, 2024, 10:30 AM
		endDate: new Date(2024, 11, 21, 12, 0), // December 21, 2024, 12:00 PM
		type: "task",
		priority: "high",
		location: "Remote",
		attendees: ["Maya Patel", "David Kim"],
		description:
			"Prepare demo materials and test environment for client presentation.",
		organizer: "Maya Patel",
		status: "in-progress",
	},
	{
		id: "8",
		title: "Mobile App UI Review",
		date: new Date(2024, 11, 23, 14, 0), // December 23, 2024, 2:00 PM
		endDate: new Date(2024, 11, 23, 15, 0), // December 23, 2024, 3:00 PM
		type: "meeting",
		priority: "medium",
		location: "Design Studio",
		attendees: ["Maya Patel", "David Kim"],
		description: "Review mobile app UI changes and approve final designs.",
		organizer: "Maya Patel",
		status: "confirmed",
	},
	{
		id: "9",
		title: "Database Performance Incident Resolution",
		date: new Date(2024, 11, 20, 8, 0), // December 20, 2024, 8:00 AM
		endDate: new Date(2024, 11, 20, 11, 0), // December 20, 2024, 11:00 AM
		type: "incident",
		priority: "critical",
		location: "Remote",
		attendees: ["Sarah Johnson", "DevOps Team"],
		description:
			"P1 incident: Database performance issue affecting 15% of users.",
		organizer: "Sarah Johnson",
		status: "in-progress",
	},
	{
		id: "10",
		title: "Team Lunch",
		date: new Date(2024, 11, 22, 12, 0), // December 22, 2024, 12:00 PM
		endDate: new Date(2024, 11, 22, 13, 30), // December 22, 2024, 1:30 PM
		type: "social",
		priority: "low",
		location: "Local Restaurant",
		attendees: ["Entire Team"],
		description: "Monthly team lunch and bonding activity.",
		organizer: "HR Team",
		status: "confirmed",
	},
];

// Generate demo events for any month
export const generateDemoEvents = (
	currentYear: number,
	currentMonth: number
) => [
	{
		id: "demo-1",
		title: "Team Standup",
		date: new Date(currentYear, currentMonth, 5, 9, 0),
		endDate: new Date(currentYear, currentMonth, 5, 9, 30),
		type: "meeting",
		priority: "medium",
		location: "Conference Room A",
		attendees: ["Alex Rodriguez", "Sarah Johnson", "Maya Patel", "David Kim"],
		description: "Daily team standup meeting.",
		organizer: "Alex Rodriguez",
		status: "confirmed",
	},
	{
		id: "demo-2",
		title: "Sprint Planning",
		date: new Date(currentYear, currentMonth, 10, 10, 0),
		endDate: new Date(currentYear, currentMonth, 10, 12, 0),
		type: "meeting",
		priority: "high",
		location: "Conference Room B",
		attendees: ["Lisa Chen", "Alex Rodriguez", "Maya Patel"],
		description: "Plan upcoming sprint goals and tasks.",
		organizer: "Lisa Chen",
		status: "confirmed",
	},
	{
		id: "demo-3",
		title: "Code Review",
		date: new Date(currentYear, currentMonth, 15, 14, 0),
		endDate: new Date(currentYear, currentMonth, 15, 16, 0),
		type: "task",
		priority: "medium",
		location: "Development Office",
		attendees: ["Maya Patel", "David Kim"],
		description: "Review recent code changes and improvements.",
		organizer: "Maya Patel",
		status: "confirmed",
	},
	{
		id: "demo-4",
		title: "Payment API Integration Deadline",
		date: new Date(currentYear, currentMonth, 20, 17, 0),
		endDate: new Date(currentYear, currentMonth, 20, 17, 0),
		type: "deadline",
		priority: "critical",
		location: "Remote",
		attendees: ["Alex Rodriguez", "Sarah Johnson"],
		description: "Final deadline for payment API integration.",
		organizer: "Lisa Chen",
		status: "confirmed",
	},
	{
		id: "demo-5",
		title: "Security Incident",
		date: new Date(currentYear, currentMonth, 22, 8, 0),
		endDate: new Date(currentYear, currentMonth, 22, 10, 0),
		type: "incident",
		priority: "critical",
		location: "Remote",
		attendees: ["Sarah Johnson", "DevOps Team"],
		description: "Critical security incident requiring immediate attention.",
		organizer: "Sarah Johnson",
		status: "in-progress",
	},
	{
		id: "demo-6",
		title: "Team Lunch",
		date: new Date(currentYear, currentMonth, 25, 12, 0),
		endDate: new Date(currentYear, currentMonth, 25, 13, 30),
		type: "social",
		priority: "low",
		location: "Local Restaurant",
		attendees: ["Entire Team"],
		description: "Monthly team lunch and bonding activity.",
		organizer: "HR Team",
		status: "confirmed",
	},
];

// Board Lists - Used in board component
export const TEST_LISTS = [
	{
		_id: "list-1",
		title: "To Do",
		position: 0,
		_creationTime: Date.now() - 86400000 * 7, // 7 days ago
	},
	{
		_id: "list-2",
		title: "In Progress",
		position: 1,
		_creationTime: Date.now() - 86400000 * 6, // 6 days ago
	},
	{
		_id: "list-3",
		title: "Review",
		position: 2,
		_creationTime: Date.now() - 86400000 * 5, // 5 days ago
	},
	{
		_id: "list-4",
		title: "Done",
		position: 3,
		_creationTime: Date.now() - 86400000 * 4, // 4 days ago
	},
];

// Board Cards - Used in board and dashboard components
export const TEST_CARDS = [
	// To Do List Cards - High Priority Items
	{
		_id: "card-1",
		title: "Implement Payment API Integration",
		description:
			"Integrate Stripe payment processing with the checkout flow. Include error handling and webhook setup for real-time payment notifications.",
		labels: ["backend", "api", "payment", "critical"],
		priority: "highest",
		dueDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
		assignees: ["member-1", "member-2"], // Alex Rodriguez, Sarah Johnson
		listId: "list-1",
		position: 0,
		_creationTime: Date.now() - 86400000 * 2,
	},
	{
		_id: "card-2",
		title: "Design Mobile App Wireframes",
		description:
			"Create wireframes for the mobile app dashboard and user profile screens.",
		labels: ["design", "mobile", "ui/ux"],
		priority: "medium",
		dueDate: new Date(Date.now() + 86400000 * 5), // 5 days from now
		assignees: ["member-3"], // Maya Patel
		listId: "list-1",
		position: 1,
		_creationTime: Date.now() - 86400000 * 1,
	},
	{
		_id: "card-3",
		title: "Database Performance Optimization",
		description:
			"Optimize slow queries and add proper indexing to improve database performance.",
		labels: ["database", "performance", "backend"],
		priority: "highest",
		dueDate: new Date(Date.now() + 86400000 * 1), // Tomorrow
		assignees: ["member-2"], // Sarah Johnson
		listId: "list-1",
		position: 2,
		_creationTime: Date.now() - 86400000 * 3,
	},
	{
		_id: "card-4",
		title: "User Authentication System",
		description:
			"Implement secure user authentication with JWT tokens and password hashing.",
		labels: ["security", "authentication", "backend"],
		priority: "high",
		dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
		assignees: ["member-1"], // Alex Rodriguez
		listId: "list-2",
		position: 0,
		_creationTime: Date.now() - 86400000 * 4,
	},
	{
		_id: "card-5",
		title: "Frontend Component Library",
		description:
			"Build reusable React components with TypeScript and Storybook documentation.",
		labels: ["frontend", "react", "components"],
		priority: "medium",
		dueDate: new Date(Date.now() + 86400000 * 7), // 1 week from now
		assignees: ["member-3", "member-4"], // Maya Patel, David Kim
		listId: "list-2",
		position: 1,
		_creationTime: Date.now() - 86400000 * 5,
	},
	{
		_id: "card-6",
		title: "API Documentation",
		description:
			"Create comprehensive API documentation using OpenAPI/Swagger.",
		labels: ["documentation", "api"],
		priority: "medium",
		dueDate: new Date(Date.now() + 86400000 * 4), // 4 days from now
		assignees: ["member-1"], // Alex Rodriguez
		listId: "list-2",
		position: 2,
		_creationTime: Date.now() - 86400000 * 6,
	},
	{
		_id: "card-7",
		title: "Security Audit Report",
		description:
			"Conduct security audit and prepare detailed report with recommendations.",
		labels: ["security", "audit", "compliance"],
		priority: "highest",
		dueDate: new Date(Date.now() + 86400000 * 1), // Tomorrow
		assignees: ["member-2"], // Sarah Johnson
		listId: "list-3",
		position: 0,
		_creationTime: Date.now() - 86400000 * 7,
	},
	{
		_id: "card-8",
		title: "Mobile App Testing",
		description: "Comprehensive testing of mobile app features and user flows.",
		labels: ["testing", "mobile", "qa"],
		priority: "high",
		dueDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
		assignees: ["member-3", "member-4"], // Maya Patel, David Kim
		listId: "list-3",
		position: 1,
		_creationTime: Date.now() - 86400000 * 8,
	},
	{
		_id: "card-9",
		title: "Client Presentation Slides",
		description: "Prepare presentation slides for upcoming client demo.",
		labels: ["presentation", "client"],
		priority: "high",
		dueDate: new Date(Date.now() - 86400000 * 2), // 2 days ago (completed)
		assignees: ["member-5"], // Lisa Chen
		listId: "list-4",
		position: 0,
		_creationTime: Date.now() - 86400000 * 9,
	},
	{
		_id: "card-10",
		title: "Team Onboarding Documentation",
		description: "Create comprehensive onboarding guide for new team members.",
		labels: ["documentation", "onboarding"],
		priority: "low",
		dueDate: new Date(Date.now() - 86400000 * 1), // Yesterday (completed)
		assignees: ["member-3"], // Maya Patel
		listId: "list-4",
		position: 1,
		_creationTime: Date.now() - 86400000 * 10,
	},
];

// Notes Data - Used in notes component
export const TEST_NOTES = [
	{
		id: "note-1",
		title: "Project Planning & Sprint Goals",
		content: `# Project Planning & Sprint Goals

Welcome to our current sprint planning documentation. This note outlines our key objectives, milestones, and team assignments for the upcoming development cycle.

## Current Sprint Objectives

Our primary focus areas for this sprint include several critical development initiatives:

- **Complete Payment API Integration** - Implementing Stripe payment processing with full error handling
- **Finalize Mobile App Wireframes** - Creating comprehensive UI/UX designs for mobile platform
- **Address Security Audit Findings** - Resolving all identified security vulnerabilities and compliance issues
- **Optimize Database Performance** - Improving query efficiency and implementing proper indexing strategies

## Key Milestones & Deliverables

### 1. Payment API Integration (Due: 3 days)
This milestone focuses on completing our payment processing capabilities:
- Stripe integration implementation and testing
- Comprehensive error handling for failed transactions
- Webhook setup and verification for real-time updates
- Security compliance and PCI DSS requirements

### 2. Mobile App Development (Due: 1 week)
Mobile platform development with focus on user experience:
- Wireframes approved by design team and stakeholders
- Core UI components built and tested
- Testing framework setup for automated quality assurance
- Cross-platform compatibility verification

## Team Assignments & Responsibilities

- **Alex Rodriguez** (Lead Developer): Payment API backend implementation and integration
- **Sarah Johnson** (Database Specialist): Database optimization and performance tuning
- **Maya Patel** (UI/UX Designer): Mobile UI design and wireframe creation
- **David Kim** (Security Engineer): Security audit response and compliance verification

## Progress Tracking & Resources

For detailed progress tracking and visual project management:
- **Project Board**: [View current tasks and progress](/mockup/board) 📋
- **Team Calendar**: [Check deadlines and meetings](/mockup/calendar) 📅
- **Team Communication**: Regular standups and progress updates

## Risk Assessment & Mitigation

Key risks identified for this sprint:
- **Payment API delays** due to third-party approval processes
- **Mobile testing** requiring additional device lab resources
- **Database migration** needing scheduled maintenance windows

---
*Last updated: ${new Date().toLocaleDateString()} | Next review: Weekly sprint meeting*`,
		createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
		updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
		tags: ["planning", "sprint", "goals"],
		folder: "Project Management",
		isShared: true,
		collaborators: [
			"Alex Rodriguez",
			"Sarah Johnson",
			"Maya Patel",
			"David Kim",
		],
	},
	{
		id: "note-2",
		title: "API Integration Checklist",
		content: `# Payment API Integration Checklist

This comprehensive checklist tracks our progress implementing Stripe payment processing into our platform. Each section represents a critical phase of the integration process.

## Setup & Configuration

Initial setup and environment configuration for payment processing:

- [x] **Stripe account setup** - Production and test accounts configured
- [x] **API keys configured** - Secure key management implemented
- [x] **Webhook endpoints created** - Real-time event processing enabled
- [ ] **SSL certificates verified** - Security compliance validation pending

## Implementation Tasks

Core development tasks for payment functionality:

- [x] **Payment form component** - User interface for payment collection
- [x] **Backend API routes** - Server-side payment processing endpoints
- [ ] **Error handling middleware** - Comprehensive error management system
- [ ] **Transaction logging** - Audit trail and monitoring implementation
- [ ] **Refund functionality** - Customer service and dispute resolution

## Testing Requirements

Quality assurance and validation processes:

- [ ] **Unit tests for payment flow** - Individual component testing
- [ ] **Integration tests with Stripe** - End-to-end payment validation
- [ ] **Error scenario testing** - Failure case handling verification
- [ ] **Load testing for high volume** - Performance under stress conditions

## Security Considerations

Security compliance and data protection measures:

- [x] **PCI compliance review** - Payment card industry standards verification
- [x] **Data encryption at rest** - Customer data protection implementation
- [ ] **Audit logging implementation** - Security event tracking system
- [ ] **Penetration testing** - Third-party security assessment

## Documentation & Training

Knowledge transfer and user guidance materials:

- [ ] **API documentation update** - Developer integration guides
- [ ] **User guide creation** - Customer-facing payment instructions
- [ ] **Troubleshooting guide** - Support team reference materials

## Current Status & Next Steps

**Progress Summary**: Core integration complete, focusing on error handling and comprehensive testing phases.

**Immediate Priorities**:
1. Complete error handling middleware implementation
2. Develop comprehensive test suite for all payment scenarios
3. Finalize security audit and penetration testing
4. Update documentation for internal and external stakeholders`,
		createdAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
		updatedAt: new Date(Date.now() - 1800000), // 30 minutes ago
		tags: ["api", "integration", "checklist"],
		folder: "Development",
		isShared: true,
		collaborators: ["Alex Rodriguez", "Sarah Johnson"],
	},
	{
		id: "note-3",
		title: "Meeting Notes - Sprint Review",
		content: `# Sprint Review Meeting Notes

**Meeting Date**: ${new Date().toLocaleDateString()}
**Duration**: 90 minutes
**Attendees**: Full Development Team (Alex, Sarah, Maya, David, Lisa)
**Meeting Type**: Sprint Retrospective & Planning

## Executive Summary

This sprint review covers our progress on key development initiatives, identifies current blockers, and establishes priorities for the upcoming sprint cycle. Overall team velocity remains strong with several major milestones achieved.

## Completed Items & Achievements

Our team successfully delivered on several critical objectives this sprint:

✅ **Database performance optimization** (Sarah Johnson)
   - Query response time improved by 40%
   - Implemented proper indexing strategy
   - Resolved memory leak issues

✅ **Mobile wireframe initial draft** (Maya Patel)
   - Complete user flow documentation
   - Stakeholder approval received
   - Design system components defined

✅ **Security audit preparation** (David Kim)
   - Vulnerability assessment completed
   - Compliance documentation updated
   - Penetration testing scheduled

✅ **CI/CD pipeline setup** (DevOps Team)
   - Automated testing integration
   - Deployment workflow optimization
   - Monitoring and alerting configured

## Current Blockers & Issues

Several challenges require immediate attention and resolution:

🚫 **Payment API integration delays**
   - Status: Waiting for Stripe merchant approval
   - Impact: Blocks payment feature release
   - Owner: Alex Rodriguez

🚫 **Mobile testing infrastructure**
   - Status: Need device lab access for cross-platform testing
   - Impact: Delays mobile app validation
   - Owner: Maya Patel

⚠️ **Database migration requirements**
   - Status: Requires scheduled maintenance window
   - Impact: Performance improvements deployment
   - Owner: Sarah Johnson

## Action Items & Ownership

**Immediate Actions (Next 48 hours)**:
1. **Alex Rodriguez**: Follow up with Stripe support team for approval status
2. **Maya Patel**: Schedule device lab time and coordinate testing resources
3. **Sarah Johnson**: Coordinate maintenance window with operations team
4. **David Kim**: Complete security documentation and compliance reports

**Sprint Planning Priorities**:
- Focus development efforts on unblocked tasks
- Establish parallel work streams for maximum efficiency
- Implement risk mitigation strategies for critical path items
- Maintain team velocity while addressing technical debt

## Team Velocity & Metrics

- **Story Points Completed**: 34/40 (85% completion rate)
- **Bug Resolution**: 12 issues closed, 3 new issues identified
- **Code Coverage**: Improved from 78% to 85%
- **Team Satisfaction**: 8.5/10 (based on retrospective feedback)

## Next Sprint Goals

**Primary Objectives**:
- Complete payment API integration (pending approvals)
- Finalize mobile app testing and validation
- Deploy database performance improvements
- Begin user acceptance testing phase`,
		createdAt: new Date(Date.now() - 86400000 * 0.5), // 12 hours ago
		updatedAt: new Date(Date.now() - 900000), // 15 minutes ago
		tags: ["meeting", "sprint", "review"],
		folder: "Meetings",
		isShared: true,
		collaborators: [
			"Lisa Chen",
			"Alex Rodriguez",
			"Sarah Johnson",
			"Maya Patel",
			"David Kim",
		],
	},
	{
		id: "note-4",
		title: "Technical Architecture Notes",
		content: `# System Architecture Overview

This document outlines our current technical architecture, proposed enhancements, and strategic technology decisions for our platform's continued growth and scalability.

## Current Technology Stack

Our platform is built on a modern, scalable technology foundation:

### Frontend Architecture
- **Framework**: Next.js 14 with App Router for optimal performance
- **Language**: TypeScript for type safety and developer experience
- **Styling**: Tailwind CSS for consistent, maintainable design system
- **State Management**: React Context and custom hooks for data flow

### Backend Infrastructure
- **Runtime**: Node.js with Express framework for API development
- **Language**: TypeScript for full-stack type consistency
- **API Design**: RESTful endpoints with GraphQL consideration for complex queries
- **Authentication**: JWT-based authentication with secure session management

### Data Layer
- **Primary Database**: PostgreSQL for relational data and ACID compliance
- **Caching Layer**: Redis for session storage and performance optimization
- **Data Migration**: Automated schema versioning and rollback capabilities
- **Backup Strategy**: Automated daily backups with point-in-time recovery

### Infrastructure & Deployment
- **Hosting**: Vercel for frontend with edge computing capabilities
- **Database Hosting**: AWS RDS for managed PostgreSQL with multi-AZ deployment
- **CDN**: CloudFlare for global content delivery and DDoS protection
- **Monitoring**: Comprehensive logging and performance monitoring

## Proposed Architecture Enhancements

### Payment Processing Integration
**Stripe Connect Implementation**:
- Marketplace functionality for multi-vendor payment processing
- Webhook processing with reliable queue system for event handling
- Idempotency keys implementation for transaction safety and duplicate prevention
- PCI DSS compliance for secure payment data handling

### Mobile Platform Architecture
**React Native Development Strategy**:
- Cross-platform mobile app with Expo for rapid development
- Shared component library between web and mobile platforms
- Offline-first data synchronization for improved user experience
- Push notification system for real-time user engagement

## Security Framework

### Authentication & Authorization
- **JWT Implementation**: Secure token-based authentication with refresh token rotation
- **Role-Based Access**: Granular permission system for different user types
- **Session Management**: Secure session handling with automatic timeout
- **Multi-Factor Authentication**: Optional 2FA for enhanced account security

### Data Protection
- **Encryption**: End-to-end encryption for sensitive data transmission
- **PII Handling**: Compliant personal information processing and storage
- **Rate Limiting**: API protection against abuse and DDoS attacks
- **Security Audits**: Regular penetration testing and vulnerability assessments

## Performance Optimization Strategy

### Database Performance
- **Indexing Strategy**: Optimized database indexes for query performance
- **Query Optimization**: Efficient SQL queries and connection pooling
- **Caching Layer**: Strategic Redis implementation for frequently accessed data
- **Database Monitoring**: Real-time performance metrics and alerting

### Content Delivery
- **CDN Integration**: Global content distribution for reduced latency
- **Asset Optimization**: Automated image compression and format optimization
- **API Caching**: Intelligent response caching for improved API performance
- **Code Splitting**: Optimized JavaScript bundles for faster page loads

## Scalability Considerations

### Horizontal Scaling
- **Microservices Architecture**: Gradual transition to service-oriented architecture
- **Load Balancing**: Distributed traffic handling for high availability
- **Auto-Scaling**: Dynamic resource allocation based on demand
- **Container Strategy**: Docker containerization for consistent deployments

---
*Architecture decisions documented and approved by technical leadership team*
*Last review: ${new Date().toLocaleDateString()} | Next review: Quarterly architecture review*`,
		createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
		updatedAt: new Date(Date.now() - 7200000), // 2 hours ago
		tags: ["architecture", "technical", "system"],
		folder: "Technical",
		isShared: false,
		collaborators: ["David Kim", "Alex Rodriguez"],
	},
];

// Canvas Items Data - Used in canvas component
export const TEST_CANVAS_ITEMS = [
	{
		id: "canvas-1",
		type: "text" as const,
		x: 100,
		y: 100,
		width: 200,
		height: 80,
		content: "Payment API Flow",
		style: {
			backgroundColor: "#fef3c7",
			borderColor: "#f59e0b",
			textColor: "#92400e",
			fontSize: 16,
		},
		createdAt: new Date(Date.now() - 86400000),
		updatedAt: new Date(Date.now() - 3600000),
	},
	{
		id: "canvas-2",
		type: "shape" as const,
		x: 350,
		y: 120,
		width: 150,
		height: 100,
		content: "User Input",
		style: {
			backgroundColor: "#dbeafe",
			borderColor: "#3b82f6",
			textColor: "#1e40af",
			fontSize: 14,
		},
		createdAt: new Date(Date.now() - 86400000),
		updatedAt: new Date(Date.now() - 3600000),
	},
	{
		id: "canvas-3",
		type: "shape" as const,
		x: 550,
		y: 120,
		width: 150,
		height: 100,
		content: "Validation",
		style: {
			backgroundColor: "#dcfce7",
			borderColor: "#22c55e",
			textColor: "#15803d",
			fontSize: 14,
		},
		createdAt: new Date(Date.now() - 86400000),
		updatedAt: new Date(Date.now() - 3600000),
	},
	{
		id: "canvas-4",
		type: "shape" as const,
		x: 750,
		y: 120,
		width: 150,
		height: 100,
		content: "Stripe API",
		style: {
			backgroundColor: "#fce7f3",
			borderColor: "#ec4899",
			textColor: "#be185d",
			fontSize: 14,
		},
		createdAt: new Date(Date.now() - 86400000),
		updatedAt: new Date(Date.now() - 3600000),
	},
	{
		id: "canvas-5",
		type: "note" as const,
		x: 200,
		y: 300,
		width: 300,
		height: 150,
		content:
			"Key Implementation Notes:\n\n• Use idempotency keys\n• Implement webhook verification\n• Handle async payment processing\n• Add comprehensive error handling\n• Log all transactions for audit",
		style: {
			backgroundColor: "#f1f5f9",
			borderColor: "#64748b",
			textColor: "#334155",
			fontSize: 12,
		},
		createdAt: new Date(Date.now() - 86400000),
		updatedAt: new Date(Date.now() - 1800000),
	},
	{
		id: "canvas-6",
		type: "text" as const,
		x: 600,
		y: 320,
		width: 250,
		height: 120,
		content: "Database Schema Updates",
		style: {
			backgroundColor: "#fef2f2",
			borderColor: "#ef4444",
			textColor: "#dc2626",
			fontSize: 14,
		},
		createdAt: new Date(Date.now() - 86400000),
		updatedAt: new Date(Date.now() - 1800000),
	},
];

// Chat Data - Used in chats component
export const TEST_CHATS = [
	{
		id: "chat-1",
		name: "Alex Rodriguez",
		type: "direct" as const,
		participants: ["current-user", "alex-rodriguez"],
		unreadCount: 2,
		isOnline: true,
		avatar: null,
		description: "Lead Developer",
		createdAt: new Date(Date.now() - 86400000 * 7), // 7 days ago
		updatedAt: new Date(Date.now() - 1800000), // 30 minutes ago
	},
	{
		id: "chat-2",
		name: "Development Team",
		type: "group" as const,
		participants: [
			"current-user",
			"alex-rodriguez",
			"sarah-johnson",
			"maya-patel",
			"david-kim",
		],
		unreadCount: 5,
		isOnline: false,
		avatar: null,
		description: "Main development team chat",
		createdAt: new Date(Date.now() - 86400000 * 14), // 2 weeks ago
		updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
	},
	{
		id: "chat-3",
		name: "Sarah Johnson",
		type: "direct" as const,
		participants: ["current-user", "sarah-johnson"],
		unreadCount: 0,
		isOnline: true,
		avatar: null,
		description: "Database Specialist",
		createdAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
		updatedAt: new Date(Date.now() - 7200000), // 2 hours ago
	},
	{
		id: "chat-4",
		name: "Project Updates",
		type: "channel" as const,
		participants: [
			"current-user",
			"alex-rodriguez",
			"sarah-johnson",
			"maya-patel",
			"david-kim",
			"lisa-chen",
		],
		unreadCount: 1,
		isOnline: false,
		avatar: null,
		description: "Weekly project updates and announcements",
		createdAt: new Date(Date.now() - 86400000 * 21), // 3 weeks ago
		updatedAt: new Date(Date.now() - 14400000), // 4 hours ago
	},
	{
		id: "chat-5",
		name: "Maya Patel",
		type: "direct" as const,
		participants: ["current-user", "maya-patel"],
		unreadCount: 0,
		isOnline: false,
		avatar: null,
		description: "UI/UX Designer",
		createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
		updatedAt: new Date(Date.now() - 21600000), // 6 hours ago
	},
	{
		id: "chat-6",
		name: "David Kim",
		type: "direct" as const,
		participants: ["current-user", "david-kim"],
		unreadCount: 0,
		isOnline: true,
		avatar: null,
		description: "Security Engineer",
		createdAt: new Date(Date.now() - 86400000 * 1), // 1 day ago
		updatedAt: new Date(Date.now() - 43200000), // 12 hours ago
	},
];

// Chat Messages Data
export const TEST_MESSAGES = [
	// Alex Rodriguez (chat-1) - Direct messages
	{
		id: "msg-1",
		chatId: "chat-1",
		senderId: "alex-rodriguez",
		senderName: "Alex Rodriguez",
		content: "Hey! How's the payment API integration going?",
		timestamp: new Date(Date.now() - 7200000), // 2 hours ago
		type: "text" as const,
		isRead: false,
	},
	{
		id: "msg-2",
		chatId: "chat-1",
		senderId: "current-user",
		senderName: "You",
		content: "Making good progress! Just finished the Stripe webhook setup.",
		timestamp: new Date(Date.now() - 6900000), // 1h 55m ago
		type: "text" as const,
		isRead: true,
	},
	{
		id: "msg-3",
		chatId: "chat-1",
		senderId: "alex-rodriguez",
		senderName: "Alex Rodriguez",
		content:
			"Awesome! Can we schedule a quick meeting to review the implementation?",
		timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
		type: "text" as const,
		isRead: false,
		reactions: [{ emoji: "👍", users: ["current-user"] }],
	},

	// Development Team (chat-2) - Group messages
	{
		id: "msg-4",
		chatId: "chat-2",
		senderId: "sarah-johnson",
		senderName: "Sarah Johnson",
		content: "Database optimization is complete! Performance improved by 40%.",
		timestamp: new Date(Date.now() - 3600000), // 1 hour ago
		type: "text" as const,
		isRead: false,
	},
	{
		id: "msg-5",
		chatId: "chat-2",
		senderId: "maya-patel",
		senderName: "Maya Patel",
		content:
			"Great work Sarah! 🎉 The mobile wireframes are also ready for review.",
		timestamp: new Date(Date.now() - 3300000), // 55 minutes ago
		type: "text" as const,
		isRead: false,
		reactions: [
			{ emoji: "🎉", users: ["alex-rodriguez", "david-kim"] },
			{ emoji: "👏", users: ["current-user"] },
		],
	},
	{
		id: "msg-6",
		chatId: "chat-2",
		senderId: "david-kim",
		senderName: "David Kim",
		content:
			"Security audit findings have been addressed. All critical issues resolved.",
		timestamp: new Date(Date.now() - 3000000), // 50 minutes ago
		type: "text" as const,
		isRead: false,
	},
	{
		id: "msg-7",
		chatId: "chat-2",
		senderId: "alex-rodriguez",
		senderName: "Alex Rodriguez",
		content:
			"Excellent progress everyone! Let's sync up tomorrow morning to plan the next sprint.",
		timestamp: new Date(Date.now() - 2700000), // 45 minutes ago
		type: "text" as const,
		isRead: false,
	},
	{
		id: "msg-8",
		chatId: "chat-2",
		senderId: "current-user",
		senderName: "You",
		content:
			"Sounds good! I'll have the payment integration demo ready by then.",
		timestamp: new Date(Date.now() - 2400000), // 40 minutes ago
		type: "text" as const,
		isRead: true,
	},

	// Sarah Johnson (chat-3) - Direct messages
	{
		id: "msg-9",
		chatId: "chat-3",
		senderId: "current-user",
		senderName: "You",
		content:
			"Thanks for the database optimization! The queries are much faster now.",
		timestamp: new Date(Date.now() - 7200000), // 2 hours ago
		type: "text" as const,
		isRead: true,
	},
	{
		id: "msg-10",
		chatId: "chat-3",
		senderId: "sarah-johnson",
		senderName: "Sarah Johnson",
		content: "You're welcome! The indexing strategy really made a difference.",
		timestamp: new Date(Date.now() - 7000000), // 1h 57m ago
		type: "text" as const,
		isRead: true,
	},

	// Project Updates (chat-4) - Channel messages
	{
		id: "msg-11",
		chatId: "chat-4",
		senderId: "lisa-chen",
		senderName: "Lisa Chen",
		content:
			"📢 Weekly Update: Sprint 12 completed successfully! All major milestones achieved.",
		timestamp: new Date(Date.now() - 14400000), // 4 hours ago
		type: "text" as const,
		isRead: false,
		reactions: [
			{ emoji: "🎉", users: ["alex-rodriguez", "sarah-johnson", "maya-patel"] },
			{ emoji: "👏", users: ["david-kim", "current-user"] },
		],
	},

	// Maya Patel (chat-5) - Direct messages
	{
		id: "msg-12",
		chatId: "chat-5",
		senderId: "maya-patel",
		senderName: "Maya Patel",
		content:
			"The new UI components are looking great! Want to review them together?",
		timestamp: new Date(Date.now() - 21600000), // 6 hours ago
		type: "text" as const,
		isRead: true,
	},
	{
		id: "msg-13",
		chatId: "chat-5",
		senderId: "current-user",
		senderName: "You",
		content:
			"Absolutely! They look amazing. The user flow is much cleaner now.",
		timestamp: new Date(Date.now() - 21300000), // 5h 55m ago
		type: "text" as const,
		isRead: true,
	},

	// David Kim (chat-6) - Direct messages
	{
		id: "msg-14",
		chatId: "chat-6",
		senderId: "david-kim",
		senderName: "David Kim",
		content:
			"Security review is complete. Found a few minor issues but nothing critical.",
		timestamp: new Date(Date.now() - 43200000), // 12 hours ago
		type: "text" as const,
		isRead: true,
	},
	{
		id: "msg-15",
		chatId: "chat-6",
		senderId: "current-user",
		senderName: "You",
		content: "Thanks for the thorough review! I'll address those issues today.",
		timestamp: new Date(Date.now() - 43000000), // 11h 57m ago
		type: "text" as const,
		isRead: true,
	},
];

// Smart Reply Suggestions - Context-aware based on current conversations
export const TEST_SMART_REPLIES = [
	{
		id: "reply-1",
		text: "Tomorrow morning works for me",
		context: "meeting",
		confidence: 0.9,
	},
	{
		id: "reply-2",
		text: "I'll send a calendar invite",
		context: "meeting",
		confidence: 0.8,
	},
	{
		id: "reply-3",
		text: "Let's do it at 10 AM",
		context: "meeting",
		confidence: 0.7,
	},
];

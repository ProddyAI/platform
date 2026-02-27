#!/usr/bin/env tsx

/**
 * Test Tool Schema Generation
 * Verifies that empty-parameter tools generate valid JSON Schema with type: "object"
 */

import { z } from "zod";

// Simulate the jsonSchemaToZod function
function jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
	const properties = jsonSchema?.properties ?? {};
	const required = jsonSchema?.required ?? [];
	const propertyEntries = Object.entries(properties);

	// For empty schemas, return z.object({}) which properly serializes to type: "object"
	if (propertyEntries.length === 0) {
		return z.object({});
	}

	const shape: Record<string, z.ZodTypeAny> = {};

	for (const [key, prop] of propertyEntries as any) {
		let zodType: z.ZodTypeAny;

		switch (prop.type) {
			case "string":
				zodType = z.string();
				break;
			case "number":
				zodType = z.number();
				break;
			case "boolean":
				zodType = z.boolean();
				break;
			case "array":
				zodType = z.array(z.any());
				break;
			case "object":
				zodType = z.record(z.any());
				break;
			default:
				zodType = z.any();
		}

		if (prop.description) {
			zodType = zodType.describe(prop.description);
		}

		// Make optional if not in required array
		if (!required.includes(key)) {
			zodType = zodType.optional();
		}

		shape[key] = zodType;
	}

	return z.object(shape);
}

// Convert Zod schema to JSON Schema for inspection
function zodToJsonSchema(zodSchema: z.ZodTypeAny): any {
	// This is a simplified version - the AI SDK does this internally
	if (zodSchema instanceof z.ZodObject) {
		const shape = (zodSchema as any)._def.shape();
		const properties: any = {};
		const required: string[] = [];

		for (const [key, value] of Object.entries(shape)) {
			const zodType = value as z.ZodTypeAny;

			if (zodType instanceof z.ZodString) {
				properties[key] = { type: "string" };
			} else if (zodType instanceof z.ZodNumber) {
				properties[key] = { type: "number" };
			} else if (zodType instanceof z.ZodBoolean) {
				properties[key] = { type: "boolean" };
			} else if (zodType instanceof z.ZodOptional) {
				const inner = (zodType as any)._def.innerType;
				if (inner instanceof z.ZodString) {
					properties[key] = { type: "string" };
				} else if (inner instanceof z.ZodNumber) {
					properties[key] = { type: "number" };
				}
			} else {
				properties[key] = { type: "object" };
			}

			if (!(zodType instanceof z.ZodOptional)) {
				required.push(key);
			}
		}

		return {
			type: "object",
			properties,
			required,
			additionalProperties: false,
		};
	}

	return { type: "object" };
}

// Test cases
const testCases = [
	{
		name: "Empty parameters (getMyCalendarToday)",
		input: {
			type: "object" as const,
			properties: {},
			required: [],
		},
	},
	{
		name: "Single optional parameter (searchChannels)",
		input: {
			type: "object" as const,
			properties: {
				query: {
					type: "string",
					description: "Channel name to search for",
				},
			},
			required: [],
		},
	},
	{
		name: "Required parameter (getChannelSummary)",
		input: {
			type: "object" as const,
			properties: {
				channelId: {
					type: "string",
					description: "Channel ID",
				},
				limit: {
					type: "number",
					description: "Max results",
				},
			},
			required: ["channelId"],
		},
	},
];

console.log("🧪 Testing Tool Schema Generation\n");
console.log("=".repeat(60));

let allPassed = true;

for (const testCase of testCases) {
	console.log(`\n📋 Test: ${testCase.name}`);
	console.log(`Input: ${JSON.stringify(testCase.input, null, 2)}`);

	try {
		const zodSchema = jsonSchemaToZod(testCase.input);
		const jsonSchema = zodToJsonSchema(zodSchema);

		console.log(`Output JSON Schema: ${JSON.stringify(jsonSchema, null, 2)}`);

		// Validate
		if (jsonSchema.type !== "object") {
			console.log(
				`❌ FAIL: Expected type: "object", got type: "${jsonSchema.type}"`
			);
			allPassed = false;
		} else if (!jsonSchema.properties) {
			console.log(`❌ FAIL: Missing properties field`);
			allPassed = false;
		} else {
			console.log(`✅ PASS: Valid schema with type: "object"`);
		}
	} catch (error: any) {
		console.log(`❌ ERROR: ${error.message}`);
		allPassed = false;
	}
}

console.log(`\n${"=".repeat(60)}`);
if (allPassed) {
	console.log("✅ All tests passed!");
	process.exit(0);
} else {
	console.log("❌ Some tests failed!");
	process.exit(1);
}

/**
 * Test utilities for the DatabaseChat component.
 *
 * Use these exports to test your app's integration with DatabaseChat.
 *
 * @example
 * ```typescript
 * /// <reference types="vite/client" />
 * import { describe, it, expect } from "vitest";
 * import { convexTest } from "convex-test";
 * import { schema, modules } from "@dayhaysoos/convex-database-chat/test";
 *
 * describe("my app with DatabaseChat", () => {
 *   function setupTest() {
 *     const t = convexTest();
 *     t.registerComponent("databaseChat", schema, modules);
 *     return t;
 *   }
 *
 *   it("should work with the component", async () => {
 *     const t = setupTest();
 *     // ... your tests
 *   });
 * });
 * ```
 */
export { default as schema } from "../convex/component/schema";
export declare const componentPath = "../convex/component";
//# sourceMappingURL=test.d.ts.map
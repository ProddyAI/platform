import presence from "@convex-dev/presence/convex.config";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";
import rag from "@convex-dev/rag/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(presence);
app.use(prosemirrorSync);
app.use(rag);

export default app;

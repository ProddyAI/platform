// Export components from the canvas folder
import { Canvas } from "./components/canvas";
import { Toolbar } from "./components/toolbar";

// Export renamed components for canvas feature
export const CanvasCanvas = Canvas;
export const CanvasToolbar = Toolbar;

// Export original components
export { Canvas, Toolbar };

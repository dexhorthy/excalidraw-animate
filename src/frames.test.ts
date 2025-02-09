import {
  detectFrames,
  adjustElementPositions,
  createFrameIntermediateRepresentation,
  animateFrames,
} from "./frames";
import type {
  NonDeletedExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawElement,
} from "@excalidraw/excalidraw/types/element/types";
import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";

// Set up JSDOM
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.document = dom.window.document;
global.window = dom.window as any;
global.XMLSerializer = window.XMLSerializer;

describe("Frame Detection", () => {
  it("should detect frame elements", () => {
    const elements: NonDeletedExcalidrawElement[] = [
      {
        id: "frame1",
        type: "frame",
      } as any,
      {
        id: "text1",
        type: "text",
        frameId: null,
      } as any,
    ];

    expect(detectFrames(elements)).toBe(true);
  });

  it("should detect elements with frameId", () => {
    const elements: NonDeletedExcalidrawElement[] = [
      {
        id: "text1",
        type: "text",
        frameId: "frame1",
      } as any,
    ];

    expect(detectFrames(elements)).toBe(true);
  });

  it("should return false when no frames present", () => {
    const elements: NonDeletedExcalidrawElement[] = [
      {
        id: "text1",
        type: "text",
        frameId: null,
      } as any,
    ];

    expect(detectFrames(elements)).toBe(false);
  });

  it("should handle elements from example file", () => {
    const elements: NonDeletedExcalidrawElement[] = [
      {
        id: "frame1",
        type: "frame",
      } as any,
    ];

    expect(detectFrames(elements)).toBe(true);
  });
});

describe("Frame Position Adjustment", () => {
  it("should handle complex frame layouts with nested elements", () => {
    const frameTLC = { x: 0, y: 0 };
    const rect1TLC = { x: 100, y: 100 };
    const text1TLC = { x: 120, y: 120 };

    const frame2TLC = { x: 2000, y: 2000 };
    const rect2TLC = { x: 2100, y: 2100 };
    const text2TLC = { x: 2120, y: 2120 };

    const elements: NonDeletedExcalidrawElement[] = [
      // First frame and its elements
      {
        id: "frame1",
        type: "frame",
        x: frameTLC.x,
        y: frameTLC.y,
      } as any,
      {
        id: "rect1",
        type: "rectangle",
        x: rect1TLC.x,
        y: rect1TLC.y,
        frameId: "frame1",
      } as any,
      {
        id: "text1",
        type: "text",
        x: text1TLC.x,
        y: text1TLC.y,
        frameId: "frame1",
        text: "agent",
      } as any,

      // Second frame and its elements
      {
        id: "frame2",
        type: "frame",
        x: frame2TLC.x,
        y: frame2TLC.y,
      } as any,
      {
        id: "rect2",
        type: "rectangle",
        x: rect2TLC.x,
        y: rect2TLC.y,
        frameId: "frame2",
      } as any,
      {
        id: "text2",
        type: "text",
        x: text2TLC.x,
        y: text2TLC.y,
        frameId: "frame2",
        text: "agent: hey",
      } as any,
    ];

    const { adjustedElements, firstFramePosition } =
      adjustElementPositions(elements);

    // First frame should be reference point
    expect(firstFramePosition).toEqual({ x: frameTLC.x, y: frameTLC.y });

    const adjustedText = adjustedElements.find((e) => e.id === "text2");
    expect(adjustedText?.x).toBe(text1TLC.x);
    expect(adjustedText?.y).toBe(text1TLC.y);

    const adjustedRect = adjustedElements.find((e) => e.id === "rect2");
    expect(adjustedRect?.x).toBe(rect1TLC.x);
    expect(adjustedRect?.y).toBe(rect1TLC.y);
  });
});

describe("Frame intermediate representation", () => {
  it("should create an intermediate representation of frames", () => {
    const elements: NonDeletedExcalidrawElement[] = [
      // First frame and its elements
      {
        id: "frame1",
        type: "frame",
        x: 10,
        y: 10,
      } as any,
      {
        id: "text1",
        type: "text",
        x: 110,
        y: 210,
        frameId: "frame1",
        text: "Hello",
      } as any,

      // Second frame and its elements
      {
        id: "frame2",
        type: "frame",
        x: 1000,
        y: 1000,
      } as any,
      {
        id: "text2",
        type: "text",
        x: 1100,
        y: 1200,
        frameId: "frame2",
        text: "World",
      } as any,
    ];

    const result = createFrameIntermediateRepresentation(elements);

    // Should have two frames
    expect(result.size).toBe(2);

    // Check first frame - should maintain original coordinates
    const frame1 = result.get("frame1");
    expect(frame1).toBeDefined();
    expect(frame1?.length).toBe(1);
    expect(frame1?.[0].id).toBe("text1");
    const text1 = frame1?.[0] as any;
    expect(text1.x).toBe(110); // Keep original x
    expect(text1.y).toBe(210); // Keep original y

    // Check second frame - should match first frame's element positions
    const frame2 = result.get("frame2");
    expect(frame2).toBeDefined();
    expect(frame2?.length).toBe(1);
    expect(frame2?.[0].id).toBe("text2");
    const text2 = frame2?.[0] as any;
    expect(text2.x).toBe(110); // Should match text1's original x
    expect(text2.y).toBe(210); // Should match text1's original y
  });

  it("should handle empty frames", () => {
    const elements: NonDeletedExcalidrawElement[] = [
      {
        id: "frame1",
        type: "frame",
        x: 0,
        y: 0,
      } as any,
      {
        id: "frame2",
        type: "frame",
        x: 1000,
        y: 0,
      } as any,
    ];

    const result = createFrameIntermediateRepresentation(elements);

    expect(result.size).toBe(2);
    expect(result.get("frame1")?.length).toBe(0);
    expect(result.get("frame2")?.length).toBe(0);
  });

  it("should handle elements without frames", () => {
    const elements: NonDeletedExcalidrawElement[] = [
      {
        id: "frame1",
        type: "frame",
        x: 0,
        y: 0,
      } as any,
      {
        id: "text1",
        type: "text",
        x: 100,
        y: 100,
        frameId: null,
        text: "No frame",
      } as any,
    ];

    const result = createFrameIntermediateRepresentation(elements);

    expect(result.size).toBe(1);
    expect(result.get("frame1")?.length).toBe(0);
  });
});

describe("Frame Animation", () => {
  it("should create animations for frame elements", () => {
    // Create a simple SVG structure
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "500");
    svg.setAttribute("height", "300");
    svg.setAttribute("viewBox", "0 0 500 300");
    svg.setAttribute("style", "background-color: white;");

    const group1 = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const rect1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    rect1.setAttribute("width", "80");
    rect1.setAttribute("height", "40");
    rect1.setAttribute("x", "100");
    rect1.setAttribute("y", "100");
    rect1.setAttribute("fill", "#fff");
    rect1.setAttribute("stroke", "#000");
    rect1.setAttribute("stroke-width", "2");

    const text1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    text1.setAttribute("x", "120");
    text1.setAttribute("y", "125");
    text1.setAttribute("font-family", "Arial");
    text1.setAttribute("font-size", "16");
    text1.textContent = "Hello";

    const group2 = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const rect2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    rect2.setAttribute("width", "80");
    rect2.setAttribute("height", "40");
    rect2.setAttribute("x", "100");
    rect2.setAttribute("y", "100");
    rect2.setAttribute("fill", "#fff");
    rect2.setAttribute("stroke", "#000");
    rect2.setAttribute("stroke-width", "2");

    const text2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    text2.setAttribute("x", "120");
    text2.setAttribute("y", "125");
    text2.setAttribute("font-family", "Arial");
    text2.setAttribute("font-size", "16");
    text2.textContent = "World";

    // Add elements to their respective groups
    group1.appendChild(rect1);
    group1.appendChild(text1);
    group2.appendChild(rect2);
    group2.appendChild(text2);

    // Add groups to SVG
    svg.appendChild(group1);
    svg.appendChild(group2);

    // Create elements with positions already adjusted
    const elements: NonDeletedExcalidrawElement[] = [
      {
        id: "frame1",
        type: "frame",
        x: 0,
        y: 0,
      } as any,
      {
        id: "rect1",
        type: "rectangle",
        x: 100,
        y: 100,
        frameId: "frame1",
      } as any,
      {
        id: "text1",
        type: "text",
        x: 120,
        y: 120,
        frameId: "frame1",
        text: "Hello",
      } as any,
      {
        id: "frame2",
        type: "frame",
        x: 0,
        y: 0,
      } as any,
      {
        id: "rect2",
        type: "rectangle",
        x: 100,
        y: 100,
        frameId: "frame2",
      } as any,
      {
        id: "text2",
        type: "text",
        x: 120,
        y: 120,
        frameId: "frame2",
        text: "World",
      } as any,
    ];

    const result = animateFrames(svg, elements, { startMs: 0 });

    // Save SVG to file for debugging
    const svgString = new XMLSerializer().serializeToString(svg);
    const outputPath = path.join(__dirname, "test-output");
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    fs.writeFileSync(path.join(outputPath, "animated-frames.svg"), svgString);

    // Verify animations
    const groups = svg.querySelectorAll("g");
    expect(groups.length).toBe(2);

    const firstGroup = groups[0];
    const firstGroupAnimations = firstGroup.querySelectorAll("animate");
    expect(firstGroupAnimations.length).toBe(2); // fade-in and fade-out

    const firstFadeIn = firstGroupAnimations[0];
    expect(firstFadeIn.getAttribute("attributeName")).toBe("opacity");
    expect(firstFadeIn.getAttribute("from")).toBe("0");
    expect(firstFadeIn.getAttribute("to")).toBe("1");
    expect(firstFadeIn.getAttribute("dur")).toBe("500ms");
    expect(firstFadeIn.getAttribute("begin")).toBe("0ms");

    const firstFadeOut = firstGroupAnimations[1];
    expect(firstFadeOut.getAttribute("attributeName")).toBe("opacity");
    expect(firstFadeOut.getAttribute("from")).toBe("1");
    expect(firstFadeOut.getAttribute("to")).toBe("0");
    expect(firstFadeOut.getAttribute("dur")).toBe("500ms");
    expect(firstFadeOut.getAttribute("begin")).toBe("2000ms");

    const secondGroup = groups[1];
    const secondGroupAnimations = secondGroup.querySelectorAll("animate");
    expect(secondGroupAnimations.length).toBe(1); // only fade-in for last frame

    const secondFadeIn = secondGroupAnimations[0];
    expect(secondFadeIn.getAttribute("attributeName")).toBe("opacity");
    expect(secondFadeIn.getAttribute("from")).toBe("0");
    expect(secondFadeIn.getAttribute("to")).toBe("1");
    expect(secondFadeIn.getAttribute("dur")).toBe("500ms");
    expect(secondFadeIn.getAttribute("begin")).toBe("2000ms");

    expect(result.finishedMs).toBe(5000); // 2000ms per frame + 1000ms margin
  });
});

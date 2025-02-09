import type { NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

export type ExcalidrawElementWithFrame = NonDeletedExcalidrawElement & {
  frameId?: string;
  x: number;
  y: number;
};

interface FramePosition {
  x: number;
  y: number;
}

interface AdjustmentResult {
  adjustedElements: NonDeletedExcalidrawElement[];
  firstFramePosition: FramePosition;
}

export const detectFrames = (
  elements: readonly NonDeletedExcalidrawElement[]
): boolean => {
  console.log(
    "Checking elements for frames:",
    elements.map((e) => ({
      id: e.id,
      type: e.type,
      frameId: (e as any).frameId,
    }))
  );
  return elements.some((ele) => {
    const element = ele as any;
    const isFrame = element.type === "frame";
    const hasFrameId = element.frameId != null && element.frameId !== "";
    console.log(
      `Element ${element.id}: isFrame=${isFrame}, hasFrameId=${hasFrameId}, type=${element.type}`
    );
    return isFrame || hasFrameId;
  });
};

export const adjustElementPositions = (
  elements: readonly NonDeletedExcalidrawElement[]
): AdjustmentResult => {
  // Find all frames and their positions
  const frames = elements.filter((e) => (e as any).type === "frame");
  if (frames.length === 0) {
    return {
      adjustedElements: [...elements],
      firstFramePosition: { x: 0, y: 0 },
    };
  }

  // Use the first frame as reference point
  const firstFrame = frames[0] as any;
  const firstFramePosition = { x: firstFrame.x, y: firstFrame.y };

  // Create a map of frame positions
  const framePositions = new Map<string, FramePosition>();
  frames.forEach((frame) => {
    framePositions.set(frame.id, { x: frame.x, y: frame.y });
  });

  // Adjust element positions
  const adjustedElements = elements
    .map((element) => {
      const e = element as ExcalidrawElementWithFrame;
      if ((e as any).type === "frame") {
        return element;
      }

      // Skip elements not in a frame
      if (!e.frameId) {
        return null;
      }

      const framePos = framePositions.get(e.frameId);
      if (framePos) {
        // Calculate element's offset from its frame
        const offsetX = e.x - framePos.x;
        const offsetY = e.y - framePos.y;

        // Apply offset to first frame position
        return {
          ...element,
          x: firstFramePosition.x + offsetX,
          y: firstFramePosition.y + offsetY,
        };
      }

      return null;
    })
    .filter((e): e is NonDeletedExcalidrawElement => e !== null);

  return { adjustedElements, firstFramePosition };
};

export const animateFrames = (
  svg: SVGSVGElement,
  elements: readonly NonDeletedExcalidrawElement[],
  options: { startMs?: number }
): { finishedMs: number } => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const startMs = options.startMs ?? 0;
  const frameDuration = 2000;
  const fadeTime = 500;
  const extraMargin = 1000;

  // Get frame groups - Excalidraw puts frames in groups with stroke-linecap="round"
  const svgFrameGroups = Array.from(
    svg.querySelectorAll("g[transform]")
  ).filter((g) => g.getAttribute("stroke-linecap") === "round");

  // Get text groups - they're in separate g elements with text children
  const svgTextGroups = Array.from(svg.querySelectorAll("g[transform]")).filter(
    (g) => g.querySelector("text")
  );

  // Map frames to their elements
  const frameMap = new Map<string, number[]>();
  const orders = new Map<string, number>();

  // First pass: collect frame elements to get proper ordering
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i] as any;
    if (e.type === "frame") {
      console.log("Found frame:", e);
      if (!frameMap.has(e.id)) {
        frameMap.set(e.id, []);
        orders.set(e.id, i);
      }
    }
  }

  // Second pass: assign elements to frames
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i] as any;
    if (e.type !== "frame" && e.frameId) {
      const frameKey = e.frameId;
      if (!frameMap.has(frameKey)) {
        frameMap.set(frameKey, []);
        orders.set(frameKey, Number.MAX_SAFE_INTEGER);
      }
      frameMap.get(frameKey)?.push(i);
    }
  }

  // Sort frames by their order of appearance
  const orderedFrames = Array.from(frameMap.entries()).sort(
    (a, b) => (orders.get(a[0]) ?? 0) - (orders.get(b[0]) ?? 0)
  );

  let current = startMs;

  // Animate frame groups
  orderedFrames.forEach(([groupKey, indices], frameIndex) => {
    console.log("Processing frame group:", groupKey, "indices:", indices);

    const frameGroup = svgFrameGroups[frameIndex];
    const textGroup = svgTextGroups[frameIndex];
    if (!frameGroup || !textGroup) return;

    frameGroup.setAttribute("opacity", "0");
    textGroup.setAttribute("opacity", "0");

    const isLastFrame = frameIndex === orderedFrames.length - 1;

    // Create fade-in animations
    const frameFadeIn = svg.ownerDocument.createElementNS(SVG_NS, "animate");
    frameFadeIn.setAttribute("attributeName", "opacity");
    frameFadeIn.setAttribute("from", "0");
    frameFadeIn.setAttribute("to", "1");
    frameFadeIn.setAttribute("dur", `${fadeTime}ms`);
    frameFadeIn.setAttribute("begin", `${current}ms`);
    frameFadeIn.setAttribute("fill", "freeze");
    frameGroup.appendChild(frameFadeIn);

    const textFadeIn = frameFadeIn.cloneNode(true) as SVGElement;
    textGroup.appendChild(textFadeIn);

    if (!isLastFrame) {
      // Create fade-out animations
      const frameFadeOut = svg.ownerDocument.createElementNS(SVG_NS, "animate");
      frameFadeOut.setAttribute("attributeName", "opacity");
      frameFadeOut.setAttribute("from", "1");
      frameFadeOut.setAttribute("to", "0");
      frameFadeOut.setAttribute("dur", `${fadeTime}ms`);
      // Start fading out when the next frame starts fading in
      frameFadeOut.setAttribute("begin", `${current + frameDuration}ms`);
      frameFadeOut.setAttribute("fill", "freeze");
      frameGroup.appendChild(frameFadeOut);

      const textFadeOut = frameFadeOut.cloneNode(true) as SVGElement;
      textGroup.appendChild(textFadeOut);
    }

    current += frameDuration;
  });

  return { finishedMs: current + extraMargin };
};

export type FrameIntermediateRepresentation = Map<
  string,
  NonDeletedExcalidrawElement[]
>;

/**
 * builds a group of elements by frame,
 * with all posititions adjusted, so that
 * a repeated element between frame 1 and frame 2
 * have the same coordinates in the final element list
 */
export const createFrameIntermediateRepresentation = (
  elements: readonly NonDeletedExcalidrawElement[]
): FrameIntermediateRepresentation => {
  // First adjust all element positions relative to first frame
  const { adjustedElements } = adjustElementPositions(elements);

  // Group elements by their frameId
  const frameMap = new Map<string, NonDeletedExcalidrawElement[]>();

  // First collect all frames
  elements.forEach((element) => {
    if ((element as any).type === "frame") {
      frameMap.set(element.id, []);
    }
  });

  // Then assign elements to their frames
  adjustedElements.forEach((element) => {
    const e = element as any;
    if (e.type !== "frame" && e.frameId && frameMap.has(e.frameId)) {
      frameMap.get(e.frameId)?.push(element);
    }
  });

  return frameMap;
};

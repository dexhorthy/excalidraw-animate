import { useCallback, useEffect, useState } from "react";

import {
  exportToSvg,
  restoreElements,
  loadLibraryFromBlob,
} from "@excalidraw/excalidraw";

import type { BinaryFiles } from "@excalidraw/excalidraw/types/types";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/excalidraw/types/element/types";

import { loadScene } from "./vendor/loadScene";
import { animateSvg } from "./animate";

const importLibraryFromUrl = async (url: string) => {
  try {
    const request = await fetch(url);
    const blob = await request.blob();
    const libraryItems = await loadLibraryFromBlob(blob);
    return libraryItems.map((libraryItem) =>
      getNonDeletedElements(restoreElements(libraryItem.elements, null))
    );
  } catch (error) {
    window.alert("Unable to load library");
    return [];
  }
};

export const getNonDeletedElements = (
  elements: readonly ExcalidrawElement[]
): NonDeletedExcalidrawElement[] =>
  elements.filter(
    (element): element is NonDeletedExcalidrawElement => !element.isDeleted
  );

export const useLoadSvg = () => {
  const [loading, setLoading] = useState(true);
  const [loadedSvgList, setLoadedSvgList] = useState<
    {
      svg: SVGSVGElement;
      finishedMs: number;
    }[]
  >([]);

  const loadDataList = useCallback(
    async (
      dataList: {
        elements: readonly ExcalidrawElement[];
        appState: Parameters<typeof exportToSvg>[0]["appState"];
        files: BinaryFiles;
      }[],
      inSequence?: boolean
    ) => {
      const hash = window.location.hash.slice(1);
      const searchParams = new URLSearchParams(hash);
      const options = {
        startMs: undefined as number | undefined,
        pointerImg: searchParams.get("pointerImg") || undefined,
        pointerWidth: searchParams.get("pointerWidth") || undefined,
        pointerHeight: searchParams.get("pointerHeight") || undefined,
      };
      const svgList = await Promise.all(
        dataList.map(async (data) => {
          const elements = getNonDeletedElements(data.elements);
          const svg = await exportToSvg({
            elements,
            files: data.files,
            appState: data.appState,
            exportPadding: 30,
          });

          // This is a patch up function to apply new fonts that are not part of Excalidraw package
          // Remove this function once Excalidraw package is updated (v0.17.6 as of now)
          await applyNewFontsToSvg(svg, elements);

          const result = animateSvg(svg, elements, options);
          console.log(svg);
          if (inSequence) {
            options.startMs = result.finishedMs;
          }
          return { svg, finishedMs: result.finishedMs };
        })
      );
      setLoadedSvgList(svgList);
      return svgList;
    },
    []
  );

  useEffect(() => {
    (async () => {
      const hash = window.location.hash.slice(1);
      const searchParams = new URLSearchParams(hash);
      const matchIdKey = /([a-zA-Z0-9_-]+),?([a-zA-Z0-9_-]*)/.exec(
        searchParams.get("json") || ""
      );
      if (matchIdKey) {
        const [, id, key] = matchIdKey;
        const data = await loadScene(id, key, null);
        const [{ svg, finishedMs }] = await loadDataList([data]);
        if (searchParams.get("autoplay") === "no") {
          svg.setCurrentTime(finishedMs);
        }
      }
      const matchLibrary = /(.*\.excalidrawlib)/.exec(
        searchParams.get("library") || ""
      );
      if (matchLibrary) {
        const [, url] = matchLibrary;
        const dataList = await importLibraryFromUrl(url);
        const svgList = await loadDataList(
          dataList.map((elements) => ({ elements, appState: {}, files: {} })),
          searchParams.has("sequence")
        );
        if (searchParams.get("autoplay") === "no") {
          svgList.forEach(({ svg, finishedMs }) => {
            svg.setCurrentTime(finishedMs);
          });
        }
      }
      setLoading(false);
    })();
  }, [loadDataList]);

  return { loading, loadedSvgList, loadDataList };
};

const DEFAULT_FONT = "Courier New";

/** Up to date version of font family. It's brought from the latest version of Excalidraw repo */
export const FONT_FAMILY = {
  Virgil: 1,
  Helvetica: 2,
  Cascadia: 3,
  // leave 4 unused as it was historically used for Assistant (which we don't use anymore) or custom font (Obsidian)
  Excalifont: 5,
  Nunito: 6,
  "Lilita One": 7,
  "Comic Shanns": 8,
  "Liberation Sans": 9,
} as const;

/**
 * Apply font family to text elements in the SVG
 */
function applyNewFontsToSvg(svg: SVGSVGElement, elements: ExcalidrawElement[]) {
  const textElements: ExcalidrawTextElement[] = elements.filter(
    (element): element is ExcalidrawTextElement =>
      element.type === "text" && !!element.fontFamily
  ) as ExcalidrawTextElement[];

  // Handle both grouped and ungrouped text elements
  svg.querySelectorAll("text").forEach((svgText) => {
    // Find corresponding text element by matching position
    const x = parseFloat(svgText.getAttribute("x") || "0");
    const y = parseFloat(svgText.getAttribute("y") || "0");
    
    const textElement = textElements.find(element => 
      Math.abs(element.x - x) < 1 && Math.abs(element.y - y) < 1
    );

    if (textElement) {
      convertFontFamily(svgText, textElement.fontFamily);
    } else {
      // Fallback to default font if no matching element found
      svgText.setAttribute("font-family", DEFAULT_FONT);
    }
  });
}

function convertFontFamily(
  textElement: SVGTextElement,
  fontFamilyNumber: number | undefined
) {
  // Remove any existing font-family attribute
  textElement.removeAttribute("font-family");
  textElement.setAttribute("font-family", DEFAULT_FONT);
}

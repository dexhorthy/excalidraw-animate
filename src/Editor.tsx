import React from "react";

import { Excalidraw } from "@excalidraw/excalidraw";

// Default font for new text in the editor.
// 1 = Hand-drawn (Virgil), 2 = Normal (Helvetica), 3 = Code (Cascadia / monospace).
// We default to Code (monospace) so the on-canvas preview is closest to the
// Courier New that the WebM pipeline forces downstream. Offline, the bundled
// Excalidraw fonts won't load and this falls back to a system monospace font,
// which is fine — the .excalidraw file stores the font *enum*, not glyphs.
const DEFAULT_FONT_FAMILY = 3;

// Full Excalidraw editor, mounted at /edit so the whole
// draw -> save-to-disk -> generate-webm loop runs offline from one dev server.
// The default UI already includes "Open" and "Save to disk" (exports .excalidraw)
// in the hamburger menu (also Cmd/Ctrl+S).
const Editor: React.FC = () => {
  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}>
      <Excalidraw
        initialData={{
          appState: { currentItemFontFamily: DEFAULT_FONT_FAMILY },
        }}
      />
    </div>
  );
};

export default Editor;

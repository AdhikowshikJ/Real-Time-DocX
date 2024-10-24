import { useCallback, useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  TextNode,
} from "lexical";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as Popover from "@radix-ui/react-popover";
import { useMediaQuery } from "@/hooks/useMediaQuery";
// We'll create this hook

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

// Custom hook for detecting device type
const useDeviceDetection = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const hasTouchScreen = useMediaQuery("(hover: none) and (pointer: coarse)");
  return { isMobile, hasTouchScreen };
};

const InlineAutoSuggestionsPlugin = (): JSX.Element | null => {
  const [editor] = useLexicalComposerContext();
  const [suggestion, setSuggestion] = useState<string>("");
  const [ghostTextPosition, setGhostTextPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const { isMobile, hasTouchScreen } = useDeviceDetection();
  const [lastTouchTime, setLastTouchTime] = useState(0);
  const [compositionEnd, setCompositionEnd] = useState(true);

  const generateSuggestion = useCallback(async (text: string) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Complete this text naturally (respond with only the completion, no quotes or explanations): "${text}"`;

      const result = await model.generateContent(prompt);
      const completion = result.response.text().trim();
      setSuggestion(completion);
      setIsVisible(true);
    } catch (error) {
      console.error("Error generating suggestion:", error);
      setSuggestion("");
      setIsVisible(false);
    }
  }, []);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion || !isVisible) return;

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const textNode = $createTextNode(suggestion);
      selection.insertNodes([textNode]);
    });

    setSuggestion("");
    setIsVisible(false);
  }, [editor, suggestion, isVisible]);

  const updateGhostPosition = useCallback(() => {
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorElement = editor.getRootElement();

      if (!editorElement) return;

      const editorRect = editorElement.getBoundingClientRect();

      // Adjust position for mobile
      if (isMobile) {
        setGhostTextPosition({
          x: Math.min(rect.right, window.innerWidth - 150), // Prevent overflow
          y: rect.bottom + window.scrollY + 10, // Show below cursor with padding
        });
      } else {
        setGhostTextPosition({
          x: rect.right,
          y: rect.top,
        });
      }
    }
  }, [editor, isMobile]);

  // Handle IME composition events
  useEffect(() => {
    const handleCompositionStart = () => setCompositionEnd(false);
    const handleCompositionEnd = () => {
      setCompositionEnd(true);
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const node = selection.anchor.getNode();
        if (!(node instanceof TextNode)) return;

        const textContent = node.getTextContent();
        const cursorPosition = selection.anchor.offset;
        const currentText = textContent.slice(0, cursorPosition);

        if (currentText.length >= 3) {
          updateGhostPosition();
          generateSuggestion(currentText);
        }
      });
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener(
        "compositionstart",
        handleCompositionStart
      );
      editorElement.addEventListener("compositionend", handleCompositionEnd);
    }

    return () => {
      if (editorElement) {
        editorElement.removeEventListener(
          "compositionstart",
          handleCompositionStart
        );
        editorElement.removeEventListener(
          "compositionend",
          handleCompositionEnd
        );
      }
    };
  }, [editor, updateGhostPosition, generateSuggestion]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!compositionEnd) return; // Skip during IME composition

      if (event.code === "Space") {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const node = selection.anchor.getNode();
          if (!(node instanceof TextNode)) return;

          const textContent = node.getTextContent();
          const cursorPosition = selection.anchor.offset;
          const currentText = textContent.slice(0, cursorPosition);

          if (currentText.length >= 3) {
            updateGhostPosition();
            generateSuggestion(currentText);
          }
        });
      } else if (event.code === "Tab" && isVisible) {
        event.preventDefault();
        acceptSuggestion();
      } else if (event.code === "Escape") {
        setSuggestion("");
        setIsVisible(false);
      } else {
        setIsVisible(false);
      }
    };

    // Touch event handlers for mobile
    const handleTouchStart = () => {
      setLastTouchTime(Date.now());
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only show suggestions if touch duration was short (not scrolling)
      const touchDuration = Date.now() - lastTouchTime;
      if (touchDuration < 200) {
        updateGhostPosition();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const node = selection.anchor.getNode();
          if (!(node instanceof TextNode)) return;

          const textContent = node.getTextContent();
          const cursorPosition = selection.anchor.offset;
          const currentText = textContent.slice(0, cursorPosition);

          if (currentText.length >= 3) {
            generateSuggestion(currentText);
          }
        });
      }
    };

    const removeUpdateListener = editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
          updateGhostPosition();
        }
      }
    );

    window.addEventListener("keydown", handleKeyDown);
    if (hasTouchScreen) {
      const editorElement = editor.getRootElement();
      if (editorElement) {
        editorElement.addEventListener("touchstart", handleTouchStart);
        editorElement.addEventListener("touchend", handleTouchEnd);
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (hasTouchScreen) {
        const editorElement = editor.getRootElement();
        if (editorElement) {
          editorElement.removeEventListener("touchstart", handleTouchStart);
          editorElement.removeEventListener("touchend", handleTouchEnd);
        }
      }
      removeUpdateListener();
    };
  }, [
    editor,
    generateSuggestion,
    acceptSuggestion,
    isVisible,
    updateGhostPosition,
    hasTouchScreen,
    lastTouchTime,
    compositionEnd,
  ]);

  if (!suggestion || !isVisible) {
    return null;
  }

  return (
    <Popover.Root open={isVisible} onOpenChange={setIsVisible}>
      <Popover.Anchor
        style={{
          position: "absolute",
          left: `${ghostTextPosition.x}px`,
          top: `${ghostTextPosition.y}px`,
        }}
      />
      <Popover.Portal>
        <Popover.Content
          side={isMobile ? "bottom" : "right"}
          sideOffset={isMobile ? 10 : 5}
          className="bg-transparent border-none shadow-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className={`flex items-center gap-1 ${
              isMobile ? "flex-col" : "flex-row"
            }`}
          >
            <span className="text-gray-500 opacity-60 pointer-events-none select-none whitespace-pre font-inherit leading-inherit">
              {suggestion}
            </span>
            {hasTouchScreen ? (
              <button
                onClick={acceptSuggestion}
                className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded select-none opacity-80 active:opacity-100"
              >
                Tap to complete
              </button>
            ) : (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded select-none opacity-80">
                Tab
              </span>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default InlineAutoSuggestionsPlugin;

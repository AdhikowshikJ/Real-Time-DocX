import { useCallback, useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, $createTextNode } from "lexical";
import * as Popover from "@radix-ui/react-popover";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { styled } from "@stitches/react";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

// Styled components remain the same
const StyledContent = styled(Popover.Content, {
  backgroundColor: "#09111f",
  padding: "4px",
  width: "300px",
  boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.4)",
  border: "1px solid #2f3042",
  zIndex: 100,
});

const SuggestionItem = styled("div", {
  padding: "8px 12px",
  cursor: "pointer",
  borderRadius: "4px",
  fontSize: "14px",
  color: "#a9b1d6",
  "&:hover": {
    backgroundColor: "#0f1c34",
  },
});

const ScrollViewport = styled(ScrollArea.Viewport, {
  width: "100%",
  height: "100%",
  maxHeight: "300px",
});

const Scrollbar = styled(ScrollArea.Scrollbar, {
  display: "flex",
  userSelect: "none",
  touchAction: "none",
  padding: "2px",
  background: "#1a1b26",
  transition: "background 160ms ease-out",
  '&[data-orientation="vertical"]': { width: "8px" },
});

const ScrollThumb = styled(ScrollArea.Thumb, {
  flex: 1,
  background: "#0f1c34",
  borderRadius: "10px",
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "100%",
    height: "100%",
    minWidth: "44px",
    minHeight: "44px",
  },
});

type Suggestion = {
  id: string;
  text: string;
};

export function AutoSuggestionsPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [anchorPos, setAnchorPos] = useState({ x: 0, y: 0 });

  const generateSuggestions = useCallback(async (text: string) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `Given this text: "${text}", suggest 5 ways to complete this sentence. Make each suggestion brief and relevant. Return only the suggestions separated by newlines.`;

      const result = await model.generateContent(prompt);
      const suggestions = result.response
        .text()
        .split("\n")
        .filter(Boolean)
        .map((text, index) => ({
          id: `suggestion-${index}`,
          text: text
            .replace(/^\d+\.\s*/, "")
            .replace(/-\s/g, "")
            .trim(),
        }));

      setSuggestions(suggestions);
      setIsOpen(true);
    } catch (error) {
      console.error("Error generating suggestions:", error);
    }
  }, []);

  const insertSuggestion = useCallback(
    (suggestion: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const textNode = $createTextNode(suggestion);
        selection.insertNodes([textNode]);
      });
      setIsOpen(false);
    },
    [editor]
  );

  useEffect(() => {
    // Handler for keydown events
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " ") {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const node = selection.anchor.getNode();
          if (!node) return;

          const textContent = node.getTextContent();
          const cursorPosition = selection.anchor.offset;
          const words = textContent.slice(0, cursorPosition).split(" ");
          const currentWord = words[words.length - 1] || "";

          // Only generate suggestions if the word is at least 3 characters
          if (currentWord.length >= 3) {
            // Update anchor position
            const domSelection = window.getSelection();
            if (domSelection && domSelection.rangeCount > 0) {
              const range = domSelection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              setAnchorPos({ x: rect.left, y: rect.bottom + 8 });
            }

            generateSuggestions(currentWord);
          }
        });
      } else if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    // Add and remove event listener
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.addEventListener("keydown", handleKeyDown);
    };
  }, [editor, generateSuggestions]);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Anchor
        style={{
          position: "absolute",
          left: anchorPos.x,
          top: anchorPos.y,
        }}
      />
      <StyledContent side="bottom" align="start" sideOffset={5}>
        <ScrollArea.Root type="auto">
          <ScrollViewport>
            {suggestions.map((suggestion) => (
              <SuggestionItem
                key={suggestion.id}
                onClick={() => insertSuggestion(suggestion.text)}
              >
                {suggestion.text}
              </SuggestionItem>
            ))}
          </ScrollViewport>
          <Scrollbar orientation="vertical">
            <ScrollThumb />
          </Scrollbar>
        </ScrollArea.Root>
      </StyledContent>
    </Popover.Root>
  );
}

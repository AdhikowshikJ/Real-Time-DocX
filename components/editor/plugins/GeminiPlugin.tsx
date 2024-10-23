import { useEffect, useState } from "react";
import { GeminiModal } from "./GeminiModal";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

export function GeminiPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "q") {
        event.preventDefault();
        setShowModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return <GeminiModal isOpen={showModal} onClose={() => setShowModal(false)} />;
}

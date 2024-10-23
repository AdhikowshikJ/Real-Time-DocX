import React, { useState, useCallback } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $createParagraphNode, $createTextNode } from "lexical";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

// Initialize Gemini API

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

interface GeminiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeminiModal({ isOpen, onClose }: GeminiModalProps) {
  const [editor] = useLexicalComposerContext();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchGeminiResponse = async () => {
    try {
      setIsLoading(true);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(prompt);
      const text = result.response
        .text()
        .replace(/\*/g, "")
        .replace(/\*\*/g, "");
      setResponse(text);
    } catch (error) {
      console.error("Error fetching from Gemini:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const insertContent = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (selection) {
        const paragraphNode = $createParagraphNode();
        const textNode = $createTextNode(response);
        paragraphNode.append(textNode);
        selection.insertNodes([paragraphNode]);
      }
    });
    onClose();
  }, [editor, response, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px] text-white bg-[#09111f] dark:bg-slate-900 border dark:border-slate-700 shadow-lg">
        <DialogHeader className="space-y-2 pb-4  dark:border-slate-700">
          <DialogTitle className="  text-white flex gap-2 ">
            Ask Gemini <Sparkles className="h-4 w-4 text-white" />
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Input
            placeholder="What would you like to know?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchGeminiResponse();
              }
            }}
            className="w-full px-3 py-2 outline-none text-white bg-transparent  dark:border-slate-700 rounded-md focus:outline-none "
          />
          {response && (
            <div className="max-h-[400px] overflow-y-auto rounded-md bg-[#0f1c34] p-4">
              <pre className="whitespace-pre-wrap font-sans text-white ">
                {response}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-end space-x-2 pt-4  dark:border-slate-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white dark:text-slate-300 bg-transparent border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
          >
            Cancel
          </Button>
          <Button
            onClick={fetchGeminiResponse}
            disabled={!prompt || isLoading}
            className="px-4 py-2 text-sm font-medium border text-white bg-[#1a2d50] hover:bg-[#5a83d1] hover:border-sl dark:bg-blue-600 dark:hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Generating..." : "Generate"}
          </Button>
          {response && (
            <Button
              onClick={insertContent}
              variant="default"
              className="px-4 py-2 text-sm font-medium text-white bg-[#3179fe] hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 rounded-md"
            >
              Insert
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GeminiModal;

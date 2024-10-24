import React from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateHtmlFromNodes } from "@lexical/html";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertInchesToTwip,
  LevelFormat,
  NumberFormat,
} from "docx";
import html2pdf from "html2pdf.js";
import { Download } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface ExportPluginProps {
  className?: string;
}

export function ExportPlugin({ className }: ExportPluginProps) {
  const [editor] = useLexicalComposerContext();

  const getEditorContent = async (): Promise<string> => {
    return new Promise((resolve) => {
      editor.update(() => {
        const htmlString = $generateHtmlFromNodes(editor);
        resolve(htmlString);
      });
    });
  };

  const parseHtmlToDocxElements = (html: string) => {
    const container = document.createElement("div");
    container.innerHTML = html;
    return convertNodeToDocxElements(container);
  };

  const convertNodeToDocxElements = (node: Node): any[] => {
    const elements: any[] = [];

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) {
        return [new TextRun({ text })];
      }
      return [];
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      const children: any[] = [];

      // Process child nodes
      element.childNodes.forEach((child) => {
        children.push(...convertNodeToDocxElements(child));
      });

      // Handle different HTML elements
      switch (element.tagName.toLowerCase()) {
        case "h1":
          return [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children,
              spacing: { before: 240, after: 120 },
            }),
          ];
        case "h2":
          return [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children,
              spacing: { before: 240, after: 120 },
            }),
          ];
        case "p":
          return [
            new Paragraph({
              children,
              spacing: { before: 120, after: 120 },
              alignment: getAlignment(style.textAlign),
            }),
          ];
        case "strong":
        case "b":
          return [new TextRun({ text: element.textContent || "", bold: true })];
        case "em":
        case "i":
          return [
            new TextRun({ text: element.textContent || "", italics: true }),
          ];
        case "u":
          return [
            new TextRun({ text: element.textContent || "", underline: {} }),
          ];
        case "br":
          return [new TextRun({ text: "\n" })];
        case "ul":
          return children.map(
            (child, index) =>
              new Paragraph({
                bullet: {
                  level: 0,
                },
                children: child.children,
              })
          );
        case "ol":
          return children.map(
            (child, index) =>
              new Paragraph({
                numbering: {
                  reference: "default-numbering",
                  level: 0,
                },
                children: child.children,
              })
          );
        case "li":
          return [
            new Paragraph({
              children,
              spacing: { before: 60, after: 60 },
            }),
          ];
        default:
          if (children.length > 0) {
            return children;
          }
          return [new TextRun({ text: element.textContent || "" })];
      }
    }

    return [];
  };

  const getAlignment = (textAlign: string): AlignmentType => {
    switch (textAlign) {
      case "center":
        return AlignmentType.CENTER;
      case "right":
        return AlignmentType.RIGHT;
      case "justify":
        return AlignmentType.JUSTIFIED;
      default:
        return AlignmentType.LEFT;
    }
  };

  const exportToWord = async (): Promise<void> => {
    try {
      const htmlContent = await getEditorContent();
      const docElements = parseHtmlToDocxElements(htmlContent);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docElements,
          },
        ],
        numbering: {
          config: [
            {
              reference: "default-numbering",
              levels: [
                {
                  level: 0,
                  format: LevelFormat.DECIMAL,
                  text: "%1.",
                  alignment: AlignmentType.LEFT,
                  style: {
                    paragraph: {
                      indent: {
                        left: convertInchesToTwip(0.5),
                        hanging: convertInchesToTwip(0.25),
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, "document.docx");
    } catch (error) {
      console.error("Error exporting to Word:", error);
    }
  };

  const exportToPdf = async (): Promise<void> => {
    try {
      const htmlContent = await getEditorContent();

      const container = document.createElement("div");
      container.innerHTML = htmlContent;

      const options = {
        margin: 1,
        filename: "document.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: true,
        },
        jsPDF: {
          unit: "in",
          format: "letter",
          orientation: "portrait" as const,
        },
      };

      await html2pdf().set(options).from(container).save();
    } catch (error) {
      console.error("Error exporting to PDF:", error);
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={`h-8 w-8 p-0 flex items-center justify-center bg-[#09111f] rounded-md ${className}`}
          aria-label="Export options"
        >
          <Download className="h-4 w-4 text-white" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] bg-[#0f1c34] rounded-md p-1 shadow-lg z-50"
          sideOffset={5}
          align="end"
        >
          <DropdownMenu.Item
            className="group text-sm rounded-md flex items-center h-8 px-2 relative select-none outline-none cursor-pointer data-[highlighted]:bg-[#0f1c34]"
            onSelect={exportToWord}
          >
            Export as Word
          </DropdownMenu.Item>

          {/* <DropdownMenu.Item
            className="group text-sm rounded-md flex items-center h-8 px-2 relative select-none outline-none cursor-pointer data-[highlighted]:bg-[#0f1c34]"
            onSelect={exportToPdf}
          >
            Export as PDF
          </DropdownMenu.Item> */}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

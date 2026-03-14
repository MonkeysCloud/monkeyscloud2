"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Undo,
  Redo,
} from "lucide-react";
import clsx from "clsx";
import { useEffect } from "react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Write something...",
  className,
  editable = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary-400 underline" },
      }),
    ],
    immediatelyRender: false,
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none px-3 py-2.5 min-h-[120px] outline-none text-sm text-surface-300 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-white [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:bg-surface-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-primary-300 [&_pre]:bg-surface-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_blockquote]:border-l-2 [&_blockquote]:border-surface-600 [&_blockquote]:pl-3 [&_blockquote]:text-surface-400",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  function ToolbarBtn({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title?: string;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={clsx(
          "p-1 rounded transition-colors",
          active
            ? "bg-primary-500/20 text-primary-400"
            : "text-surface-500 hover:text-surface-300 hover:bg-surface-800"
        )}
      >
        {children}
      </button>
    );
  }

  function addLink() {
    const url = prompt("Enter URL:");
    if (url) {
      editor!.chain().focus().setLink({ href: url }).run();
    }
  }

  return (
    <div
      className={clsx(
        "rounded-lg border border-surface-700 bg-surface-900 overflow-hidden focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500/30",
        className
      )}
    >
      {editable && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-surface-700 bg-surface-900/80 flex-wrap">
          <ToolbarBtn
            onClick={() => editor!.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor!.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor!.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor!.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <span className="w-px h-4 bg-surface-700 mx-1" />

          <ToolbarBtn
            onClick={() =>
              editor!.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() =>
              editor!.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <span className="w-px h-4 bg-surface-700 mx-1" />

          <ToolbarBtn
            onClick={() => editor!.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor!.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor!.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            title="Code Block"
          >
            <Code className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={addLink}
            active={editor.isActive("link")}
            title="Link"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <span className="w-px h-4 bg-surface-700 mx-1" />

          <ToolbarBtn
            onClick={() => editor!.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor!.chain().focus().redo().run()}
            title="Redo"
          >
            <Redo className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

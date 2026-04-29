import type { Metadata } from "next";
import { EditorShell } from "@/components/editor-shell";

export const metadata: Metadata = {
  title: "Markdown Editor — DropItX",
  description: "Write and preview markdown with a powerful code editor",
};

export default function EditorPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <EditorShell />
    </div>
  );
}

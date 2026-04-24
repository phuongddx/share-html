import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

interface ImageDropOptions {
  onImageFile: (file: File, view: EditorView) => void;
}

export function imageDropExtension({ onImageFile }: ImageDropOptions): Extension {
  return EditorView.domEventHandlers({
    drop(event, view) {
      const files = event.dataTransfer?.files;
      if (!files?.length) return false;
      const file = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (!file) return false;
      event.preventDefault();
      onImageFile(file, view);
      return true;
    },
    paste(event, view) {
      const items = event.clipboardData?.items;
      if (!items) return false;
      const imageItem = Array.from(items).find((i) =>
        i.type.startsWith("image/")
      );
      if (!imageItem) return false;
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return false;
      onImageFile(file, view);
      return true;
    },
  });
}

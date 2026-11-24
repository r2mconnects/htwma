import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  ImageInput,
  emptyImage,
  stageImageUpload,
  rollbackStagedUploads,
  type ImageValue,
} from "@/components/admin/ImageInput";
import { resizeImage, validateImageFile } from "@/lib/image";

vi.mock("@/lib/image", async (original) => ({
  ...(await original<typeof import("@/lib/image")>()),
  resizeImage: vi.fn(),
}));
vi.mock("@/components/StorageImage", () => ({ StorageImage: () => null }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("gallery image uploads", () => {
  it("accepts camera photos above 8 MB before resizing but rejects oversized/non-image files", () => {
    expect(
      validateImageFile(
        new File([new Uint8Array(9 * 1024 * 1024)], "camera.jpg", { type: "image/jpeg" }),
      ),
    ).toBeNull();
    expect(
      validateImageFile(
        new File([new Uint8Array(26 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" }),
      ),
    ).toContain("25 MB");
    expect(
      validateImageFile(new File(["text"], "fake.txt", { type: "text/plain" })),
    ).not.toBeNull();
  });

  it("keeps text entered during resizing and blocks Save until processing completes", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:preview", revokeObjectURL: vi.fn() });
    let finish!: (blob: Blob) => void;
    vi.mocked(resizeImage).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    function Editor() {
      const [state, setState] = useState<{ title: string; image: ImageValue }>({
        title: "",
        image: emptyImage(),
      });
      const [busy, setBusy] = useState(false);
      return (
        <>
          <input
            aria-label="Title"
            value={state.title}
            onChange={(e) => {
              const title = e.target.value;
              setState((s) => ({ ...s, title }));
            }}
          />
          <ImageInput
            label="Photo"
            bucket="public-media"
            value={state.image}
            onBusyChange={setBusy}
            onChange={(image) => setState((s) => ({ ...s, image }))}
          />
          <button disabled={busy}>Save</button>
        </>
      );
    }
    const { container } = render(<Editor />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["image"], "photo.jpg", { type: "image/jpeg" })] },
    });
    expect(screen.getByText("Save")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New title" } });
    finish(new Blob(["jpeg"], { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByText("Save")).toBeEnabled());
    expect(screen.getByLabelText("Title")).toHaveValue("New title");
    await waitFor(() => expect(screen.getByAltText("Photo preview")).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it("stages the storage path for the database and rolls back only new uploads on failure", async () => {
    const upload = vi.fn().mockResolvedValue("2026-11/new.jpg");
    const remove = vi.fn().mockResolvedValue(undefined);
    const staged = await stageImageUpload(
      { path: "old.jpg", file: new Blob(["jpeg"]), removed: false },
      "public-media",
      upload,
    );
    expect(staged.nextPath).toBe("2026-11/new.jpg");
    expect(remove).not.toHaveBeenCalled();
    await rollbackStagedUploads([staged], remove);
    expect(remove).toHaveBeenCalledExactlyOnceWith("public-media", "2026-11/new.jpg");
  });
});

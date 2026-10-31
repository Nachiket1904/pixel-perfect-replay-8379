import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodeEditor } from "@/components/editor/code-editor";
import { useDraft } from "@/components/editor/use-draft";

// Monaco needs a real browser and a CDN; a textarea stands in for it here.
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v?: string) => void }) => (
    <textarea aria-label="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe("CodeEditor", () => {
  it("edits, resets and runs", async () => {
    const onChange = vi.fn();
    const onRun = vi.fn();
    render(
      <CodeEditor
        label="test"
        value="print(2)"
        initialValue="print(1)"
        onChange={onChange}
        onRun={onRun}
      />,
    );
    const box = await screen.findByLabelText("editor");
    fireEvent.change(box, { target: { value: "print(3)" } });
    expect(onChange).toHaveBeenLastCalledWith("print(3)");

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onChange).toHaveBeenLastCalledWith("print(1)");

    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("shows Stop while running and hides Run without onRun", async () => {
    const onStop = vi.fn();
    const { rerender } = render(
      <CodeEditor
        label="t"
        value=""
        onChange={() => {}}
        onRun={() => {}}
        running
        onStop={onStop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledOnce();
    rerender(<CodeEditor label="t" value="" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /run/i })).toBeNull();
  });
});

describe("useDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("restores a saved draft and clears it when back to the starter", () => {
    window.localStorage.setItem("padhlo:draft:r/n", "saved code");
    const { result } = renderHook(() => useDraft("r/n", "starter"));
    expect(result.current[0]).toBe("saved code");

    act(() => result.current[1]("starter"));
    act(() => vi.advanceTimersByTime(500));
    expect(window.localStorage.getItem("padhlo:draft:r/n")).toBeNull();

    act(() => result.current[1]("new code"));
    act(() => vi.advanceTimersByTime(500));
    expect(window.localStorage.getItem("padhlo:draft:r/n")).toBe("new code");
  });
});

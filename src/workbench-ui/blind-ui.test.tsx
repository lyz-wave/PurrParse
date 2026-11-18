import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEMO_DOCUMENTS } from "@/plugins";
import { BottomArsenalRenderer } from "./BottomArsenalRenderer";
import { DualColumnRow } from "./DualColumnRow";
import { TopMentalPanel } from "./TopMentalPanel";

describe("Strict Blind UI Components", () => {
  it("renders TopMentalPanel diagram and triggers node jump callbacks", () => {
    const doc = DEMO_DOCUMENTS[0];
    const onJump = vi.fn();
    const { container } = render(
      <TopMentalPanel model={doc.topMentalModel} onJumpToUnit={onJump} />
    );

    const clickableGroup = container.querySelector("svg g.cursor-pointer");
    expect(clickableGroup).not.toBeNull();
    if (clickableGroup) fireEvent.click(clickableGroup);
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it("renders DualColumnRow blindly for both prose (paper) and code (repo) units", () => {
    const paperDoc = DEMO_DOCUMENTS[0];
    const repoDoc = DEMO_DOCUMENTS[2];
    const onJump = vi.fn();
    const onNote = vi.fn();
    const onTip = vi.fn();

    const { container: paperDom } = render(
      <DualColumnRow
        unit={paperDoc.units[0]}
        layoutRatio={paperDoc.layoutRatio}
        dimensions={paperDoc.dimensions}
        labels={paperDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        isFlashed={false}
        userNote="Test note"
        onUserNoteChange={onNote}
        onJumpToUnit={onJump}
        onHoverTooltip={onTip}
        onLeaveTooltip={() => {}}
      />
    );
    expect(paperDom.textContent).toContain(paperDoc.units[0].unitCode);
    expect(paperDom.textContent).toContain(paperDoc.units[0].secondaryBlockText.slice(0, 12));

    const { container: repoDom } = render(
      <DualColumnRow
        unit={repoDoc.units[0]}
        layoutRatio={repoDoc.layoutRatio}
        dimensions={repoDoc.dimensions}
        labels={repoDoc.labels}
        activeDimFilter={null}
        hideSecondary={false}
        hideNotes={false}
        isFlashed={false}
        userNote=""
        onUserNoteChange={onNote}
        onJumpToUnit={onJump}
        onHoverTooltip={onTip}
        onLeaveTooltip={() => {}}
      />
    );
    expect(repoDom.querySelector("pre")).not.toBeNull();
    expect(repoDom.textContent).toContain("api.py");
  });

  it("renders BottomArsenalRenderer across all mode block types cleanly", () => {
    const essayDoc = DEMO_DOCUMENTS[1];
    const repoDoc = DEMO_DOCUMENTS[2];
    const onCheck = vi.fn();

    const { container: essayDom } = render(
      <BottomArsenalRenderer
        title={essayDoc.bottomTitle}
        subtitle={essayDoc.bottomSubtitle}
        blocks={essayDoc.bottomBlocks}
        onJournalChange={() => {}}
        onChecklistToggle={onCheck}
        onDiffChange={() => {}}
      />
    );
    const checkbox = essayDom.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    if (checkbox) fireEvent.click(checkbox);
    expect(onCheck).toHaveBeenCalledTimes(1);

    const { container: repoDom } = render(
      <BottomArsenalRenderer
        title={repoDoc.bottomTitle}
        subtitle={repoDoc.bottomSubtitle}
        blocks={repoDoc.bottomBlocks}
        onJournalChange={() => {}}
        onChecklistToggle={() => {}}
        onDiffChange={() => {}}
      />
    );
    expect(repoDom.textContent).toContain("BEFORE");
    expect(repoDom.textContent).toContain("AFTER");
  });
});

type SheetPreviewPanelProps = {
  sheetDataUrl: string | null;
  sheetInfo: string;
  onGenerateSheet: () => void;
};

export function SheetPreviewPanel({ sheetDataUrl, sheetInfo, onGenerateSheet }: SheetPreviewPanelProps) {
  return (
    <div className="sheet-panel">
      {sheetDataUrl ? (
        <>
          <div className="sheet-info">{sheetInfo}</div>
          <img src={sheetDataUrl} alt="spritesheet" />
        </>
      ) : <button type="button" onClick={onGenerateSheet}>Generate Sheet Preview</button>}
    </div>
  );
}

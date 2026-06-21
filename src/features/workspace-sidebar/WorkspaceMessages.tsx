type WorkspaceMessagesProps = {
  error: string | null;
  notice: string;
};

export function WorkspaceMessages({ error, notice }: WorkspaceMessagesProps) {
  return (
    <>
      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}
    </>
  );
}

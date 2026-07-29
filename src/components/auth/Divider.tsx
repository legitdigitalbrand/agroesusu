export function Divider() {
  return (
    <div className="flex items-center gap-2.5 my-3.5">
      <div className="flex-1 h-px bg-border-line" />
      <span className="text-[12px] text-ink-soft">or</span>
      <div className="flex-1 h-px bg-border-line" />
    </div>
  );
}

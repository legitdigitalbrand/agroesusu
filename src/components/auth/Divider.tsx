export function Divider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-ink/10" />
      <span className="text-[11px] text-ink-soft font-mono uppercase tracking-wider">or</span>
      <div className="flex-1 h-px bg-ink/10" />
    </div>
  );
}

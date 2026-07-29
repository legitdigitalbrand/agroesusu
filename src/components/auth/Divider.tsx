export function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ background: "#D6E8D2" }} />
      <span className="text-[12px] text-ink-soft">or</span>
      <div className="flex-1 h-px" style={{ background: "#D6E8D2" }} />
    </div>
  );
}

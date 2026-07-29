import Link from "next/link";

interface SwitchAuthLinkProps {
  text: string;
  linkText: string;
  href: string;
}

export function SwitchAuthLink({ text, linkText, href }: SwitchAuthLinkProps) {
  return (
    <p className="text-[13px] text-ink-soft text-center mt-4">
      {text}{" "}
      <Link href={href} className="text-indigo font-semibold hover:underline">
        {linkText}
      </Link>
    </p>
  );
}

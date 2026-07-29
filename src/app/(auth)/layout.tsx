// Auth layout — minimal wrapper.
// Login and Signup pages already handle their own backgrounds (bg-indigo-deep).
// This layout just passes children through without adding redundant chrome.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

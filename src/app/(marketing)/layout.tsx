import React from 'react';
import Header from '@/components/marketing/header';
import Footer from '@/components/marketing/footer';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-paper">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}

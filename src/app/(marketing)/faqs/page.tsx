import React from 'react';
import Link from 'next/link';
import { HelpCircle, ChevronRight, HelpCircle as HelpIcon, ArrowRight } from 'lucide-react';

const categories = [
  {
    category: 'General Enquiries',
    faqs: [
      {
        question: 'What is AgroEsusu?',
        answer: 'AgroEsusu is a digital agricultural savings and credit platform designed specifically for Nigerian farmers, cooperatives, and agribusinesses. We help you automate your individual or group savings, earn high interest, and access fair, harvest-aligned loans.',
      },
      {
        question: 'How do I access AgroEsusu without internet access?',
        answer: 'You can easily access AgroEsusu from anywhere in Nigeria on any basic phone by dialing *347*88#. Our secure USSD channel lets you check balances, make cooperative payments, save, and apply for loans without any data or internet.',
      },
      {
        question: 'What are the charges for using AgroEsusu?',
        answer: 'AgroEsusu has zero hidden maintenance fees, zero account opening fees, and zero card management fees. We keep our fees completely transparent and as low as possible to support the local food system.',
      },
    ],
  },
  {
    category: 'Savings & Cooperative Circles',
    faqs: [
      {
        question: 'How does the Cooperative "Esusu" Savings Plan work?',
        answer: 'AgroEsusu digitizes traditional Esusu contribution circles. A group administrator sets up the group, adds verified member phone numbers, and defines contribution terms (daily, weekly, monthly). Members save directly, check the ledger in real-time, and payouts are distributed automatically based on the cycle calendar.',
      },
      {
        question: 'What interest rates do you offer on savings?',
        answer: 'We offer up to 15% annual interest on our Harvest Lock (Fixed Deposit) plans, 12% on Cooperative Esusu savings, and 10% on Personal Target plans. Interest is calculated daily and credited directly to your active wallets.',
      },
      {
        question: 'Is there a minimum savings amount?',
        answer: 'No! There is no minimum savings amount or opening balance. You can start saving with as little as ₦100 to build your financial standing and loan limits.',
      },
    ],
  },
  {
    category: 'Loans & Credit Products',
    faqs: [
      {
        question: 'How do I qualify for an agricultural loan on AgroEsusu?',
        answer: 'To qualify for our seed and input loans, you must be a registered member of AgroEsusu and have a verified profile (including BVN verification). Active savings history or being part of an approved, active agricultural cooperative group dramatically improves your loan approval odds.',
      },
      {
        question: 'What are the loan interest rates and repayment terms?',
        answer: 'Our interest rates range from 1.2% to 2.0% monthly depending on the loan type (seed input, machinery lease, cooperative, trade finance). Terms range from 3 to 18 months, with repayment calendars aligned with your actual crop harvest cycles.',
      },
      {
        question: 'Does AgroEsusu require collateral for loans?',
        answer: 'No physical property or heavy land collateral is required for smallholder input loans (up to ₦300,000). Instead, we utilize peer-to-peer co-guarantees through cooperatives, active savings records, and digital farm validation.',
      },
    ],
  },
  {
    category: 'Security, Partners & Legals',
    faqs: [
      {
        question: 'Is my money safe with AgroEsusu?',
        answer: 'Absolutely. All user funds and deposits are securely managed by our banking partner, Safe Haven Microfinance Bank, which is licensed by the Central Bank of Nigeria (CBN). Deposits are fully insured by the Nigeria Deposit Insurance Corporation (NDIC).',
      },
      {
        question: 'Why do I need to verify my BVN (Bank Verification Number)?',
        answer: 'In compliance with CBN (Central Bank of Nigeria) guidelines, BVN verification is mandatory to prevent identity theft, fraudulent activities, and money laundering. Your BVN does not give us access to your bank account; it simply validates your real identity.',
      },
    ],
  },
];

export default function FaqsPage() {
  return (
    <div className="bg-white">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-brand-cream/80 to-white py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold text-brand-primary uppercase tracking-widest bg-brand-primary/10 px-4 py-1.5 rounded-full border border-brand-primary/20">
            Frequently Asked Questions
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Got Questions? We Have Answers.
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about our savings circles, seasonal loans, offline USSD code, 
            and licensing security.
          </p>
        </div>
      </section>

      {/* Accordions */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="space-y-16">
          {categories.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-6">
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 border-b border-gray-100 pb-3">
                {cat.category}
              </h2>
              <div className="space-y-4">
                {cat.faqs.map((faq, faqIdx) => (
                  <details
                    key={faqIdx}
                    className="group border border-gray-100 rounded-2xl bg-white p-5 shadow-sm [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer focus:outline-none list-none">
                      <h4 className="text-base font-bold text-gray-900 group-open:text-brand-primary pr-4 transition-colors">
                        {faq.question}
                      </h4>
                      <span className="bg-gray-50 text-gray-400 group-open:bg-brand-primary/10 group-open:text-brand-primary p-1.5 rounded-lg shrink-0 transition-all">
                        <ChevronRight className="h-4 w-4 transform group-open:rotate-90 transition-transform duration-200" />
                      </span>
                    </summary>
                    <div className="mt-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4 animate-in fade-in duration-200">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Support Info */}
      <section className="bg-gray-50 border-t border-b border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <HelpIcon className="h-12 w-12 text-brand-gold mx-auto" />
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Still have questions?
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Our agricultural cooperative customer support desk is available 24 hours a day, 
            7 days a week. We are happy to jump on a call and walk you through.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/contact" className="btn-primary py-3 px-8 text-sm font-semibold">
              Contact Support
            </Link>
            <Link href="/signup" className="btn-secondary py-3 px-8 text-sm font-semibold bg-white border border-gray-200 text-gray-700">
              Register Account <ArrowRight className="h-4 w-4 ml-1 inline" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

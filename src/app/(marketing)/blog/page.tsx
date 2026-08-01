import React from 'react';
import Link from 'next/link';
import { Clock, ArrowRight, BookOpen } from 'lucide-react';

const categories = ['All', 'Agro-Fintech', 'Cooperative Savings', 'Farming Loans', 'Market Updates', 'Success Stories'];

const posts = [
  {
    id: 'cooperative-savings-yields',
    title: 'How Cooperative Savings (Esusu) Drive Agricultural Yields in South-West Nigeria',
    excerpt: 'Discover how digitizing traditional rotational Ajo contributions helps local farming clusters pool investment, secure seed inputs, and avoid predatory middlemen.',
    category: 'Cooperative Savings',
    date: 'July 18, 2026',
    readTime: '6 min read',
    author: 'Chioma Nze',
    authorRole: 'Cooperative Specialist',
    initials: 'CN',
    bg: 'bg-loam-light text-indigo',
  },
  {
    id: 'weather-insurance-harvest',
    title: 'Understanding Weather-Index Crop Insurance: Protecting Your Yield Against Drought',
    excerpt: 'A comprehensive guide explaining how Agriqcap partners with insurance companies to automatically protect farmers from rainfall deficits and sudden flash flooding.',
    category: 'Agro-Fintech',
    date: 'July 10, 2026',
    readTime: '8 min read',
    author: 'Aminu Dankwambo',
    authorRole: 'Head Agronomist',
    initials: 'AD',
    bg: 'bg-loam-light text-indigo',
  },
  {
    id: 'first-loan-application',
    title: '5 Crucial Rules for Applying for Your First Agro-Input Loan This Planting Season',
    excerpt: 'How to prepare your farm documents, verify your local cooperative standing, calculate realistic cash flows, and secure seed loans without stress.',
    category: 'Farming Loans',
    date: 'June 28, 2026',
    readTime: '5 min read',
    author: 'Tunde Alao',
    authorRole: 'CEO & Co-founder',
    initials: 'TA',
    bg: 'bg-ochre-light text-indigo',
  },
  {
    id: 'ussd-transforming-inclusion',
    title: 'How Offline USSD Codes are Quietly Transforming Financial Inclusion in Rural Communities',
    excerpt: 'Analyzing the huge impact of our dial-code channel *347*88# on helping remote farmers check active group ledger sheets and complete daily savings circles.',
    category: 'Agro-Fintech',
    date: 'June 15, 2026',
    readTime: '7 min read',
    author: 'Babajide Bello',
    authorRole: 'Head of Engineering',
    initials: 'BB',
    bg: 'bg-parchment text-indigo',
  },
  {
    id: 'rice-market-updates-2026',
    title: 'Mid-Year Rice & Maize Price Outlook: Key Trends for Aggregators & Merchants',
    excerpt: 'Get the latest bulk purchase pricing updates across key commodity hubs in northern Nigeria to optimize your buying schedules and logistics.',
    category: 'Market Updates',
    date: 'June 02, 2026',
    readTime: '4 min read',
    author: 'Kolawole Ibrahim',
    authorRole: 'Market Analyst',
    initials: 'KI',
    bg: 'bg-loam-light text-loam',
  },
  {
    id: 'success-ogun-rice-coop',
    title: 'Success Story: How Ogun Rice cooperative members doubled their acreage in one year',
    excerpt: 'Read the story of 14 farmers in Obafemi Owode LGA who pooled their Esusu savings and unlocked ₦2.5 Million in group loans to mechanize their harvest.',
    category: 'Success Stories',
    date: 'May 20, 2026',
    readTime: '6 min read',
    author: 'Agriqcap Outreach',
    authorRole: 'Field Success Team',
    initials: 'AE',
    bg: 'bg-ochre-light text-indigo-deep',
  },
];

export default function BlogPage() {
  return (
    <div className="bg-paper">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-parchment/80 to-paper py-16 md:py-24 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold text-indigo uppercase tracking-widest bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
            Insights & Guides
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight max-w-3xl mx-auto">
            The Agriqcap Agribusiness & Finance Blog
          </h1>
          <p className="text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Stay up to date with agriculture sector trends, cooperative growth strategies, micro-credit guides, 
            and success stories from the field.
          </p>
        </div>
      </section>

      {/* Categories Bar */}
      <section className="border-b border-line bg-parchment/50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 overflow-x-auto no-scrollbar py-2 text-sm font-semibold text-ink-soft">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                className={`px-4 py-1.5 rounded-full transition-all shrink-0 ${
                  idx === 0
                    ? 'bg-indigo text-white'
                    : 'bg-paper border border-line hover:border-indigo/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Cards Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article
              key={post.id}
              className="card-surface border border-line flex flex-col justify-between hover:shadow-md transition-all hover:border-indigo/10 group"
            >
              <div className="space-y-4">
                {/* Meta details */}
                <div className="flex items-center justify-between text-xs text-ink-soft font-medium">
                  <span className="text-indigo font-bold bg-indigo/5 px-2.5 py-1 rounded-lg">
                    {post.category}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{post.readTime}</span>
                  </div>
                </div>

                <Link href={`/blog/${post.id}`}>
                  <h3 className="text-xl font-bold text-ink group-hover:text-indigo transition-colors leading-snug">
                    {post.title}
                  </h3>
                </Link>

                <p className="text-sm text-ink-soft leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
              </div>

              {/* Author & Footer */}
              <div className="pt-6 border-t border-line/80 mt-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full ${post.bg} font-bold text-xs flex items-center justify-center shrink-0`}>
                    {post.initials}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink leading-none">{post.author}</p>
                    <p className="text-[12px] text-ink-soft mt-0.5 leading-none">{post.authorRole}</p>
                  </div>
                </div>

                <Link
                  href={`/blog/${post.id}`}
                  className="text-indigo font-bold text-xs flex items-center gap-1 hover:text-indigo-deep transition-colors"
                >
                  Read <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA Box */}
      <section className="bg-parchment border-t border-b border-ochre/10 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <BookOpen className="h-10 w-10 text-ochre mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Subscribe to our Agribusiness Newsletter
          </h2>
          <p className="text-sm sm:text-base text-ink-soft max-w-md mx-auto leading-relaxed">
            Get monthly market price outlooks, planting reminders, and extension updates 
            delivered directly to your email or mobile phone via SMS.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-md mx-auto">
            <input
              type="email"
              className="input-field bg-paper"
              placeholder="Enter your email address"
              required
            />
            <button className="btn-primary shrink-0 px-6 py-2.5">
              Subscribe
            </button>
          </div>
          <span className="text-[12px] text-ink-soft block">We respect your privacy. Unsubscribe anytime.</span>
        </div>
      </section>
    </div>
  );
}

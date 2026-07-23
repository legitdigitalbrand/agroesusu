import Link from 'next/link';

export const metadata = { title: 'Farm & Finance — Agroesusu Blog', description: 'Insights on agricultural finance, savings, and farm management.' };

const posts = [
  { tag: 'Loans', title: 'How to qualify for a ₦5M farm loan in 2026', excerpt: 'Everything you need to know about BVN verification, credit scoring, and getting approved.', date: 'Jul 2026', read: '5 min', color: 'bg-forest-green' },
  { tag: 'Savings', title: 'Esusu circles: The traditional savings method, digitized', excerpt: 'How rotating savings groups work on Agroesusu and why they matter for farmers.', date: 'Jul 2026', read: '4 min', color: 'bg-earth-gold' },
  { tag: 'Payments', title: '5 ways Agroesusu helps you manage farm expenses', excerpt: 'From seeds to irrigation — track and pay for everything in one place.', date: 'Jun 2026', read: '3 min', color: 'bg-rust-orange' },
  { tag: 'Credit', title: 'Understanding your credit score as a farmer', excerpt: 'What factors affect your score and how to improve it over time.', date: 'Jun 2026', read: '6 min', color: 'bg-forest-green-dark' },
  { tag: 'Seasonality', title: 'Planning your farm loan around the planting season', excerpt: 'Timing matters. Here\'s how to align borrowing with your harvest cycle.', date: 'May 2026', read: '4 min', color: 'bg-earth-gold' },
  { tag: 'Insurance', title: 'Are your farm deposits protected? Here\'s what you need to know', excerpt: 'How deposit insurance works with our licensed partner bank.', date: 'May 2026', read: '3 min', color: 'bg-forest-green' },
];

export default function BlogPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-forest-green mb-4">Farm & Finance</h1>
      <p className="text-lg text-gray-600 mb-12">Insights on agricultural finance, savings, and farm management.</p>

      <div className="grid md:grid-cols-2 gap-6">
        {posts.map((post, i) => (
          <Link key={i} href="/blog" className="group block">
            <div className={`${post.color} h-48 rounded-xl mb-3 flex items-center justify-center text-white/20 text-5xl`}>
              {post.tag.charAt(0)}
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full text-white ${post.color}`}>{post.tag}</span>
            <h2 className="font-semibold text-gray-900 mt-2 group-hover:text-forest-green transition">{post.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{post.excerpt}</p>
            <p className="text-xs text-gray-400 mt-2">{post.date} • {post.read} read</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

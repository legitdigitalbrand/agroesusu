import Link from 'next/link';
import Image from 'next/image';
import { Shield, Landmark, Banknote, ArrowRight } from 'lucide-react';
import FeatureSwitcher from '@/components/marketing/feature-switcher';
import Testimonials from '@/components/marketing/testimonials';

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-12">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-forest-green tracking-tight leading-tight">
              Grow your farm,<br />grow your money
            </h1>
            <p className="text-lg text-gray-600 mt-4">
              Loans, savings, and payments built for Nigerian farmers. Powered by a licensed partner bank.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Link href="/signup" className="px-6 py-3 bg-forest-green text-white rounded-xl font-semibold hover:bg-forest-green-dark transition">
                Get Started
              </Link>
              <Link href="/loan-plans" className="text-forest-green font-medium text-sm hover:underline flex items-center gap-1">
                Learn more <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flex gap-3 mt-6">
              <div className="px-4 py-2.5 bg-black text-white rounded-xl text-xs font-medium">
                <div className="text-[10px] opacity-60">Download on the</div>
                <div className="text-sm font-semibold">App Store</div>
              </div>
              <div className="px-4 py-2.5 bg-black text-white rounded-xl text-xs font-medium">
                <div className="text-[10px] opacity-60">Get it on</div>
                <div className="text-sm font-semibold">Google Play</div>
              </div>
            </div>
          </div>
          <div className="relative h-72 md:h-96 rounded-3xl overflow-hidden shadow-sm">
            <Image
              src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=900"
              alt="Nigerian farmer tending to a vibrant green crop field at sunrise"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
            <div className="w-12 h-12 bg-forest-green/10 rounded-xl flex items-center justify-center">
              <Landmark className="text-forest-green" size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Licensed Partner Bank</p>
              <p className="text-xs text-gray-500">Regulated & compliant</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
            <div className="w-12 h-12 bg-forest-green/10 rounded-xl flex items-center justify-center">
              <Shield className="text-forest-green" size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Deposit Insurance</p>
              <p className="text-xs text-gray-500">Your savings are protected</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
            <div className="w-12 h-12 bg-forest-green/10 rounded-xl flex items-center justify-center">
              <Banknote className="text-forest-green" size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Fast Farm Loans</p>
              <p className="text-xs text-gray-500">Instant decisions, same-day funding</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Switcher */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <FeatureSwitcher />
      </section>

      {/* Knowledge Board */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Farm & Finance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { tag: 'Loans', title: 'How to qualify for a ₦5M farm loan in 2026', color: 'bg-forest-green', image: 'https://images.unsplash.com/photo-1554474190-2c5c600f8a95?auto=format&fit=crop&q=80&w=600', alt: 'Farmer reviewing loan documents' },
            { tag: 'Savings', title: 'Esusu circles: The traditional savings method, digitized', color: 'bg-earth-gold', image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5a2104a?auto=format&fit=crop&q=80&w=600', alt: 'Community of farmers saving together' },
            { tag: 'Payments', title: '5 ways Agroesusu helps you manage farm expenses', color: 'bg-rust-orange', image: 'https://images.unsplash.com/photo-1605000797499-36a1e2d41793?auto=format&fit=crop&q=80&w=600', alt: 'Farmer making mobile payments' },
          ].map((post, i) => (
            <Link key={i} href="/blog" className="group">
              <div className="relative h-48 rounded-xl mb-3 overflow-hidden">
                <Image
                  src={post.image}
                  alt={post.alt}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-300"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full text-white ${post.color}`}>{post.tag}</span>
              <h3 className="font-semibold text-gray-900 mt-2 group-hover:text-forest-green transition">{post.title}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Honest opinions about us</h2>
          <Testimonials />
        </div>
      </section>

      {/* App Download Banner */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16">
        <div className="bg-forest-green text-white rounded-3xl p-8 md:p-12 overflow-hidden relative">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-2xl font-bold">It's simpler & easier on the app</h2>
              <p className="text-white/80 mt-2">Download the Agroesusu app for the full experience.</p>
            </div>
            <div className="flex gap-3">
              <div className="px-5 py-3 bg-white text-forest-green rounded-xl">
                <div className="text-[10px] opacity-60">Download on the</div>
                <div className="text-sm font-semibold">App Store</div>
              </div>
              <div className="px-5 py-3 bg-white text-forest-green rounded-xl">
                <div className="text-[10px] opacity-60">Get it on</div>
                <div className="text-sm font-semibold">Google Play</div>
              </div>
            </div>
          </div>
          <div className="absolute right-0 top-0 w-64 h-full opacity-20">
            <Image
              src="https://images.unsplash.com/photo-1605000797499-36a1e2d41793?auto=format&fit=crop&q=80&w=400"
              alt="Farmer using mobile app"
              fill
              className="object-cover"
              sizes="256px"
            />
          </div>
        </div>
      </section>
    </>
  );
}

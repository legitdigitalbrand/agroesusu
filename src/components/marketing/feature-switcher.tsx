'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Banknote, PiggyBank, Sprout } from 'lucide-react';
import SafeImage from './safe-image';

const tabs = [
  {
    id: 'borrow',
    label: 'Borrow & Grow',
    icon: Banknote,
    heading: 'Farm loans without the hassle',
    description: 'Get instant decisions on crop, livestock, and equipment loans. No collateral, no guarantor. Borrow from ₦50,000 to ₦10,000,000 with flexible terms from 3 to 12 months.',
    link: '/loan-plans',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=800',
    imageAlt: 'Nigerian farmer inspecting crops in a green field',
    gradient: 'from-forest-green to-forest-green-dark',
  },
  {
    id: 'save',
    label: 'Save & Thrive',
    icon: PiggyBank,
    heading: 'Esusu savings, reimagined',
    description: 'Join esusu circles with trusted farmers or start a solo target-savings plan. Lock funds in fixed deposits and earn competitive interest. Your money grows while you plan the next harvest.',
    link: '/savings-plans',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800',
    imageAlt: 'African farmers meeting in a group, discussing savings',
    gradient: 'from-earth-gold to-earth-gold-dark',
  },
  {
    id: 'pay',
    label: 'Farm & Pay',
    icon: Sprout,
    heading: 'Pay for everything you need',
    description: 'Buy seeds, fertilizer, and farm inputs. Pay bills, send money to any Nigerian bank, and manage your finances — all from your Agroesusu account.',
    link: '/features',
    image: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=800',
    imageAlt: 'Farmer using a mobile phone for digital payments',
    gradient: 'from-rust-orange to-forest-green',
  },
];

export default function FeatureSwitcher() {
  const [active, setActive] = useState(0);
  const tab = tabs[active];

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActive(i)}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl text-left transition ${
              active === i ? 'bg-forest-green text-white' : 'bg-white border text-gray-600 hover:border-forest-green'
            }`}
          >
            <t.icon size={20} />
            <span className="font-medium text-sm">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-center bg-white rounded-3xl border p-6 md:p-10 animate-fade-in">
        <div className="max-w-xl">
          <h3 className="text-2xl md:text-3xl font-bold mb-3">{tab.heading}</h3>
          <p className="text-gray-600 mb-6">{tab.description}</p>
          <Link href={tab.link} className="inline-flex items-center gap-1 text-forest-green font-medium hover:gap-2 transition-all">
            Learn More <ArrowRight size={18} />
          </Link>
        </div>
        <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden">
          <SafeImage
            src={tab.image}
            alt={tab.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={active === 0}
            gradient={tab.gradient}
          />
        </div>
      </div>
    </div>
  );
}

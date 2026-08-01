import React from 'react';
import Link from 'next/link';
import { Sprout, Users, ShieldCheck, Heart } from 'lucide-react';

const values = [
  {
    title: 'Mutual Trust',
    desc: 'We are built on the historical foundation of cooperative trust. Every transaction is transparent, and every record is fully open to its respective members.',
    icon: ShieldCheck,
  },
  {
    title: 'Financial Inclusion',
    desc: 'We design for the last mile. Our offline USSD integrations mean that lack of internet or a basic mobile phone will never stand in the way of a farmer\'s growth.',
    icon: Users,
  },
  {
    title: 'Agri-Centricity',
    desc: 'We align everything — our savings plans, our flexible lending calendars, and our advisory alerts — around the unique, seasonal cycles of crop and animal production.',
    icon: Sprout,
  },
  {
    title: 'Sustainable Impact',
    desc: 'We measure our success by the actual improvements in crop yields, cooperative welfare, and the long-term wealth of the families and communities we serve.',
    icon: Heart,
  },
];

const team = [
  {
    name: 'Tunde Alao',
    role: 'CEO & Co-founder',
    bio: 'Former senior agri-tech specialist and product manager at top Nigerian fintechs. Passionate about applying modern ledger systems to rural agriculture.',
    initials: 'TA',
    color: 'bg-loam-light text-indigo',
  },
  {
    name: 'Chioma Nze',
    role: 'Chief Operating Officer & Co-founder',
    bio: 'Cooperative micro-finance expert with over 12 years of field experience structuring group lending schemes across South-West and South-South Nigeria.',
    initials: 'CN',
    color: 'bg-ochre-light text-indigo',
  },
  {
    name: 'Babajide Bello',
    role: 'Head of Engineering',
    bio: 'Former lead engineer at Carbon and FairMoney. Architect of high-availability, secure financial ledger APIs that scale to millions of daily requests.',
    initials: 'BB',
    color: 'bg-indigo/10 text-indigo',
  },
  {
    name: 'Aminu Dankwambo',
    role: 'Head of Agricultural Extension',
    bio: 'Agronomist and rural outreach manager. Oversees our network of regional farm validation agents and extension tip broadcasting systems.',
    initials: 'AD',
    color: 'bg-parchment text-indigo',
  },
];

export default function AboutPage() {
  return (
    <div className="bg-paper">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-parchment/80 to-paper py-16 md:py-24 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold text-indigo uppercase tracking-widest bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
            Our Story
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight max-w-3xl mx-auto">
            Empowering the Hands that Feed Nigeria
          </h1>
          <p className="text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Agriqcap was founded to bring digital security, automation, and fair interest rates 
            to the traditional "Esusu" cooperative savings culture across Nigeria.
          </p>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-extrabold text-ink tracking-tight">
              Why We Started Agriqcap
            </h2>
            <p className="text-base text-ink-soft leading-relaxed">
              Nigeria is home to over 38 million smallholder farmers. However, they continue to face 
              extreme difficulty accessing formal finance. Traditional banking institutions demand 
              onerous collateral and charge predatory interest rates, while local "Ajo" or "Esusu" savings 
              groups, though highly supportive, suffer from physical security vulnerabilities, human error, and manual tracking.
            </p>
            <p className="text-base text-ink-soft leading-relaxed">
              Agriqcap bridges this gap. By building custom-tailored mobile and offline USSD tools, we 
              empower local cooperative circles to digitize their rotational funds, enjoy high interest yields, 
              and unlock fair, non-collateralized credit matching their seasonal harvests.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Mission Card */}
            <div className="bg-parchment p-8 rounded-2xl border border-ochre/10 space-y-3">
              <span className="text-xs font-bold text-ochre uppercase tracking-wider block">Our Mission</span>
              <h3 className="text-2xl font-bold text-ink">Nurture Agricultural Wealth</h3>
              <p className="text-sm text-ink-soft leading-relaxed">
                To equip Nigerian farmers and agricultural cooperatives with highly secure, automated wealth building tools 
                and affordable credit, helping them eradicate poverty and achieve national food security.
              </p>
            </div>

            {/* Vision Card */}
            <div className="bg-indigo text-white p-8 rounded-2xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-paper/5 rounded-full blur-xl"></div>
              <span className="text-xs font-bold text-ochre uppercase tracking-wider block">Our Vision</span>
              <h3 className="text-2xl font-bold text-white">Universal Inclusive Finance</h3>
              <p className="text-sm text-white/70 leading-relaxed">
                An ecosystem where every smallholder farmer, cooperative member, and agricultural merchant in Africa 
                has instant, secure, offline-capable access to wealth-building options and ethical financial support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="bg-parchment py-20 border-t border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold text-ink tracking-tight">
              Values That Keep Us Grounded
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              At Agriqcap, we are guided by a core set of beliefs that define how we build products and 
              treat our rural agribusiness communities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div key={idx} className="bg-paper p-6 rounded-2xl border border-line shadow-sm space-y-4">
                  <div className="bg-indigo/10 text-indigo w-10 h-10 rounded-xl flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-base text-ink">{val.title}</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">{val.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Leadership Team Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl font-extrabold text-ink tracking-tight">
            Our Leadership Team
          </h2>
          <p className="text-sm sm:text-base text-ink-soft">
            We are a group of dedicated agronomists, software developers, cooperative specialists, 
            and compliance leaders working together for the future of Nigerian agribusiness.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {team.map((member, idx) => (
            <div key={idx} className="card-surface border border-line flex flex-col justify-between hover:shadow-md transition-all">
              <div className="space-y-4">
                {/* Simulated Avatar */}
                <div className={`w-14 h-14 rounded-2xl ${member.color} flex items-center justify-center font-bold text-lg`}>
                  {member.initials}
                </div>
                <div>
                  <h4 className="font-bold text-lg text-ink">{member.name}</h4>
                  <p className="text-xs text-indigo font-semibold">{member.role}</p>
                </div>
                <p className="text-xs text-ink-soft leading-relaxed">{member.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Call to Action */}
      <section className="bg-gradient-to-r from-indigo to-indigo-deep text-white py-16 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Partnered with Licensed Financial Institutions
          </h2>
          <p className="text-base text-white/70 max-w-xl mx-auto leading-relaxed">
            All banking services, transfers, and wallet services are licensed through Safe Haven 
            Microfinance Bank, regulated by the Central Bank of Nigeria (CBN).
          </p>
          <div className="pt-2">
            <Link href="/signup" className="btn-secondary bg-ochre text-ink font-bold hover:bg-ochre-light py-3 px-8 text-sm">
              Create Your Account Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

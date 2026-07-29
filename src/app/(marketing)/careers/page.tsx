import React from 'react';
import Link from 'next/link';
import { Award, Briefcase, MapPin, Clock, ArrowRight, Heart, Users, Sparkles } from 'lucide-react';

const benefits = [
  {
    title: 'Meaningful Direct Impact',
    desc: 'Every line of code you write, every campaign you launch, and every field visit you make directly improves the livelihoods of farmers and secures food for millions.',
    icon: Heart,
  },
  {
    title: 'Work Flexibly',
    desc: 'We are remote-first and hybrid-friendly. Work from anywhere in Nigeria, or visit our collaborative hubs in Lagos, Ibadan, or Kano.',
    icon: Sparkles,
  },
  {
    title: 'Continuous Learning',
    desc: 'Work alongside world-class engineers, cooperative economists, and agronomists. We offer generous training budgets and mentorship.',
    icon: Users,
  },
  {
    title: 'Comprehensive Well-being',
    desc: 'Competitive salaries, comprehensive health insurance (HMO) covering you and your family, annual wellness benefits, and paid time off.',
    icon: Award,
  },
];

const jobs = [
  {
    id: 'backend-engineer',
    title: 'Senior Backend Engineer (Financial Ledgers)',
    department: 'Engineering',
    location: 'Lagos (Hybrid) / Remote',
    type: 'Full-Time',
    description: 'Lead the design, development, and scaling of our secure double-entry transactional ledger APIs. Experience with highly reliable banking systems and database performance tuning is required.',
  },
  {
    id: 'regional-growth',
    title: 'Regional Growth Manager (Northern Nigeria)',
    department: 'Operations & Growth',
    location: 'Kano / Kaduna (On-site)',
    type: 'Full-Time',
    description: 'Grow and oversee our cooperative network, expand input supplier partnerships, and lead our field extension officer teams in Kano, Kaduna, and Jigawa states. Fluency in Hausa is required.',
  },
  {
    id: 'product-designer',
    title: 'Senior Product Designer (Mobile & USSD UX)',
    department: 'Product & Design',
    location: 'Lagos (Hybrid) / Remote',
    type: 'Full-Time',
    description: 'Shape the offline-first experience for our mobile and USSD channels. You will lead field research with cooperative members to design highly intuitive, multilingual financial interfaces.',
  },
  {
    id: 'extension-lead',
    title: 'Agricultural Extension Operations Lead',
    department: 'Agronomy & Outreach',
    location: 'Ibadan (Hybrid) / Field-based',
    type: 'Full-Time',
    description: 'Manage our national agricultural tips database, structure index-weather crop insurance mapping, and lead agronomic educational outreach programs for saving cooperatives.',
  },
];

export default function CareersPage() {
  return (
    <div className="bg-white">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-parchment/80 to-white py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold text-indigo uppercase tracking-widest bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
            Join Our Team
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Build the Future of Agricultural Finance
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            We are looking for creative thinkers, passionate problem solvers, and domain experts 
            to help us digitize agricultural cooperatives and eliminate financial exclusion.
          </p>
        </div>
      </section>

      {/* Why Join Us: Benefits Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Cultivate Your Career at AgroEsusu
          </h2>
          <p className="text-sm sm:text-base text-gray-500">
            We provide our teams with the resources, benefits, and support they need to deliver outstanding 
            solutions for our farming partners.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            return (
              <div key={idx} className="bg-parchment border border-ochre/10 p-8 rounded-2xl flex gap-4">
                <div className="bg-indigo text-white p-3 rounded-xl shrink-0 h-12 w-12 flex items-center justify-center">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-lg text-gray-900">{benefit.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{benefit.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Open Positions */}
      <section className="bg-gray-50 border-t border-b border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Current Open Roles
            </h2>
            <p className="text-sm sm:text-base text-gray-500">
              Apply today and make a real difference in the lives of millions of agricultural producers.
            </p>
          </div>

          <div className="space-y-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-indigo/10 transition-all flex flex-col md:flex-row justify-between gap-6"
              >
                <div className="space-y-4 max-w-3xl">
                  {/* Meta details */}
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="bg-indigo/5 text-indigo px-2.5 py-1 rounded-lg">
                      {job.department}
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {job.location}
                    </span>
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {job.type}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900">
                    {job.title}
                  </h3>

                  <p className="text-sm text-gray-500 leading-relaxed">
                    {job.description}
                  </p>
                </div>

                <div className="flex items-center shrink-0">
                  <Link
                    href={`/contact?subject=Careers&position=${job.id}`}
                    className="btn-primary flex items-center gap-1 w-full md:w-auto text-center justify-center font-bold text-sm px-6 py-2.5 rounded-lg"
                  >
                    Apply Now <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* General Application Callout */}
      <section className="py-20 text-center max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <Briefcase className="h-12 w-12 text-ochre mx-auto" />
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Don’t see your dream role listed?
        </h2>
        <p className="text-gray-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          We are always looking for visionary agricultural enthusiasts and builders. Send us a 
          spontaneous application detailing what you want to achieve at AgroEsusu.
        </p>
        <div className="pt-2">
          <Link
            href="mailto:careers@agroesusu.com"
            className="btn-primary py-3 px-8 text-sm font-semibold"
          >
            Email: careers@agroesusu.com
          </Link>
        </div>
      </section>
    </div>
  );
}

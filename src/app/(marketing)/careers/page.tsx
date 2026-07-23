import Link from 'next/link';

export const metadata = { title: 'Careers at Agroesusu', description: 'Work with us to build the future of agricultural finance.' };

export default function CareersPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-forest-green mb-4">Working with us</h1>
      <p className="text-lg text-gray-600 mb-12">Help us build the future of agricultural finance for millions of Nigerian farmers.</p>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {[
          { title: 'Mission-driven', desc: 'Every line of code helps a farmer access credit they couldn\'t get before.' },
          { title: 'Remote-first', desc: 'We hire across Nigeria and beyond. Work from where you\'re most productive.' },
          { title: 'Fast-growing', desc: 'Join a team scaling rapidly to serve farmers across all 36 states.' },
        ].map((v) => (
          <div key={v.title} className="p-5 bg-white rounded-xl border">
            <h3 className="font-semibold text-gray-900">{v.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{v.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">Open Roles</h2>
      <div className="space-y-3 mb-8">
        {[
          { role: 'Senior Backend Engineer', dept: 'Engineering', location: 'Remote (Nigeria)' },
          { role: 'Product Designer', dept: 'Design', location: 'Lagos / Remote' },
          { role: 'Credit Risk Analyst', dept: 'Risk & Analytics', location: 'Lagos' },
          { role: 'Field Operations Lead', dept: 'Operations', location: 'Ibadan' },
        ].map((job) => (
          <div key={job.role} className="flex items-center justify-between p-4 bg-white rounded-xl border hover:border-forest-green transition">
            <div>
              <p className="font-medium text-gray-900">{job.role}</p>
              <p className="text-sm text-gray-500">{job.dept} • {job.location}</p>
            </div>
            <Link href="/contact" className="text-sm text-forest-green font-medium hover:underline">Apply →</Link>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-500">Don't see a role that fits? <Link href="/contact" className="text-forest-green font-medium hover:underline">Send us your CV</Link> and we'll keep you in mind.</p>
    </div>
  );
}

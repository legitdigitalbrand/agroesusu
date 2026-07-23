'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  { initials: 'AO', name: 'Adebayo O.', role: 'Maize Farmer, Oyo', quote: "I got a ₦500,000 loan in 10 minutes. Used it to buy seeds and fertilizer for the planting season. The repayment schedule was clear from the start." },
  { initials: 'NK', name: 'Nkechi K.', role: 'Poultry Farmer, Imo', quote: "The esusu circle feature saved my farm. I saved with 5 other farmers and we took turns receiving the pool. No more waiting for bank loans." },
  { initials: 'MS', name: 'Musa S.', role: 'Rice Farmer, Kebbi', quote: "Agroesusu paid for my irrigation equipment directly through the app. I didn't have to travel to town or deal with cash. Everything was instant." },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((p) => (p + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative max-w-3xl mx-auto">
      <div className="overflow-hidden">
        <div className="transition-transform duration-500" style={{ transform: `translateX(-${current * 100}%)` }}>
          <div className="flex">
            {testimonials.map((t, i) => (
              <div key={i} className="w-full flex-shrink-0 px-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-forest-green/10 flex items-center justify-center mx-auto mb-4 text-forest-green font-bold">
                    {t.initials}
                  </div>
                  <p className="text-lg text-gray-700 italic mb-4">"{t.quote}"</p>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <button onClick={() => setCurrent((p) => (p - 1 + testimonials.length) % testimonials.length)} className="p-2 rounded-full hover:bg-cream transition">
          <ChevronLeft size={20} className="text-gray-400" />
        </button>
        <div className="flex gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition ${i === current ? 'bg-forest-green w-6' : 'bg-gray-300'}`}
            />
          ))}
        </div>
        <button onClick={() => setCurrent((p) => (p + 1) % testimonials.length)} className="p-2 rounded-full hover:bg-cream transition">
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}

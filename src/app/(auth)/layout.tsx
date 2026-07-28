import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-gradient-to-br from-brand-primary-dark via-brand-primary to-emerald-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background abstract shapes */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-brand-gold/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-brand-primary-light/20 blur-[120px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-2 group">
            {/* Elegant Premium AgroEsusu SVG Logo */}
            <div className="w-12 h-12 rounded-xl bg-white shadow-md flex items-center justify-center border border-brand-gold/20 transition-transform group-hover:scale-105">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Sprout path in deep green */}
                <path
                  d="M16 4C16 4 10 10 10 16C10 20.4183 13.5817 24 16 24C18.4183 24 22 20.4183 22 16C22 10 16 4 16 4Z"
                  fill="#0B6B3A"
                />
                {/* Golden coin representing savings/wealth (Esusu) */}
                <circle cx="16" cy="16" r="4" fill="#D4A574" />
                {/* Leaf veins in white/gold */}
                <path
                  d="M16 11V21"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M16 14C17 15 18 15.5 19 15.5"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M16 17C15 18 14 18.5 13 18.5"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white tracking-tight leading-none">
                Agro<span className="text-brand-gold">Esusu</span>
              </span>
              <span className="text-[10px] text-white/70 tracking-widest uppercase mt-0.5 font-semibold">
                Save & Grow
              </span>
            </div>
          </Link>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100 sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}

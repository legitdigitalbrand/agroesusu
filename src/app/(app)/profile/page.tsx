import { createClient } from '@/lib/supabase/server';
import { Shield, MapPin, Phone, Mail, User } from 'lucide-react';

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

  const kycBadge = {
    tier_0: { label: 'Unverified', color: 'bg-gray-100 text-gray-500' },
    tier_1: { label: 'Tier 1', color: 'bg-blue-50 text-blue-700' },
    tier_2: { label: 'Tier 2', color: 'bg-forest-green/10 text-forest-green' },
    tier_3: { label: 'Tier 3', color: 'bg-forest-green text-white' },
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* KYC Status */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="text-forest-green" size={24} />
          <div>
            <h2 className="font-semibold text-gray-900">KYC Verification</h2>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${kycBadge[profile?.kyc_tier as keyof typeof kycBadge]?.color || kycBadge.tier_0.color}`}>
              {kycBadge[profile?.kyc_tier as keyof typeof kycBadge]?.label || 'Unverified'}
            </span>
          </div>
        </div>
        {profile?.bvn_verified && (
          <div className="text-sm text-green-600 flex items-center gap-1">
            ✓ BVN Verified
          </div>
        )}
        {profile?.kyc_tier !== 'tier_3' && (
          <button className="mt-3 text-sm text-forest-green font-medium hover:underline">
            Upgrade KYC Tier →
          </button>
        )}
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Personal Information</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <User size={18} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Full Name</p>
              <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail size={18} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-900">{profile?.email || session.user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone size={18} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Phone</p>
              <p className="text-sm font-medium text-gray-900">{profile?.phone || 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin size={18} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Location</p>
              <p className="text-sm font-medium text-gray-900">
                {profile?.lga ? `${profile.lga}, ${profile.state}` : 'Not set'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Farm Details */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Farm Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Farm Type</p>
            <p className="font-medium text-gray-900 capitalize">{profile?.farm_type?.replace(/_/g, ' ') || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Farm Size</p>
            <p className="font-medium text-gray-900">{profile?.farm_size ? `${profile.farm_size} acres` : 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Years Farming</p>
            <p className="font-medium text-gray-900">{profile?.years_farming || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Primary Produce</p>
            <p className="font-medium text-gray-900">{profile?.primary_produce || 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Monthly Income</p>
            <p className="font-medium text-gray-900">{profile?.monthly_income_estimate ? `₦${profile.monthly_income_estimate.toLocaleString()}` : 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Credit Score</p>
            <p className="font-medium text-gray-900">{profile?.credit_score || 'Not scored yet'}</p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Security</h2>
        <div className="space-y-3">
          <button className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-cream transition">
            <span className="text-sm font-medium text-gray-700">Change Password</span>
            <span className="text-gray-400">→</span>
          </button>
          <button className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-cream transition">
            <span className="text-sm font-medium text-gray-700">Change Transaction PIN</span>
            <span className="text-gray-400">→</span>
          </button>
          <button className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-cream transition">
            <span className="text-sm font-medium text-gray-700">Device Management</span>
            <span className="text-gray-400">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

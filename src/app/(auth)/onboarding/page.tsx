"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldCheck, Check, Loader2, ArrowRight, ChevronRight,
} from "lucide-react";
import { Card, Button } from "@/components/yield";
import { useMe } from "@/hooks/use-me";

// ════════════════════════════════════════════════════════════
// Progressive Verification Page
//
// Tier 0: Account created (name, email, phone) — dashboard accessible
// Tier 1: BVN + NIN verified — deposits up to ₦50,000
// Tier 2: Address + occupation verified — loans, higher limits
// Tier 3: Farm/business details + next of kin — full features
//
// This page is optional — users can always access their dashboard.
// ════════════════════════════════════════════════════════════

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [bvn, setBvn] = useState("");
  const [nin, setNin] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [occupation, setOccupation] = useState("");
  const [farmType, setFarmType] = useState("");
  const [primaryProduce, setPrimaryProduce] = useState("");
  const [nokName, setNokName] = useState("");
  const [nokPhone, setNokPhone] = useState("");
  const [nokRelationship, setNokRelationship] = useState("");

  const currentTier = me?.profile?.kyc_level || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo" />
      </div>
    );
  }

  const handleSave = async (tier: number) => {
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updateData: Record<string, unknown> = {};

    if (tier >= 1) {
      updateData.bvn = bvn || null;
      updateData.nin = nin || null;
      updateData.kyc_tier = "tier_1";
    }
    if (tier >= 2) {
      updateData.residential_address = address;
      updateData.state = state;
      updateData.lga = lga;
      updateData.occupation = occupation;
      updateData.kyc_tier = "tier_2";
    }
    if (tier >= 3) {
      updateData.farm_type = farmType;
      updateData.primary_produce = primaryProduce;
      updateData.nok_name = nokName;
      updateData.nok_phone = nokPhone;
      updateData.nok_relationship = nokRelationship;
      updateData.kyc_tier = "tier_3";
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // Also update customer status if moving to tier 2+
    if (tier >= 2) {
      await supabase
        .from("customers")
        .update({ status: "active" })
        .eq("auth_id", user.id);
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 justify-center mb-3">
            <ShieldCheck className="h-6 w-6 text-indigo" />
            <h1 className="font-display text-2xl text-ink">Verify your account</h1>
          </div>
          <p className="text-sm text-ink-soft">
            Complete verification to unlock more features. Your dashboard is always accessible.
          </p>
        </div>

        {/* Tier progress */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[0, 1, 2, 3].map((tier) => (
            <div key={tier} className="flex items-center">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${
                currentTier >= tier
                  ? "bg-indigo text-white"
                  : "bg-track/20 text-ink-soft"
              }`}>
                {currentTier > tier ? <Check className="h-4 w-4" /> : tier}
              </div>
              {tier < 3 && (
                <div className={`w-12 h-0.5 ${currentTier > tier ? "bg-indigo" : "bg-track/20"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-ink-soft mb-8 px-2">
          <span>Basic</span>
          <span>Identity</span>
          <span>Address</span>
          <span>Full</span>
        </div>

        {success && (
          <Card className="mb-6 bg-loam/5 border-loam/30">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-loam" />
              <p className="text-sm text-loam font-medium">Verification saved! Redirecting to dashboard…</p>
            </div>
          </Card>
        )}

        {/* Tier 1: BVN + NIN */}
        {currentTier < 1 && (
          <Card className="mb-4">
            <h2 className="font-display text-lg text-ink mb-1">Tier 1 — Identity Verification</h2>
            <p className="text-xs text-ink-soft mb-4">Required for deposits above ₦50,000</p>
            <div className="space-y-3">
              <div>
                <label className="ys-label">BVN (11 digits)</label>
                <input
                  type="text"
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value)}
                  maxLength={11}
                  className="ys-input"
                  placeholder="00000000000"
                />
              </div>
              <div>
                <label className="ys-label">NIN (11 digits)</label>
                <input
                  type="text"
                  value={nin}
                  onChange={(e) => setNin(e.target.value)}
                  maxLength={11}
                  className="ys-input"
                  placeholder="00000000000"
                />
              </div>
              <Button onClick={() => handleSave(1)} disabled={saving || (bvn.length !== 11 && nin.length !== 11)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & continue"}
              </Button>
            </div>
          </Card>
        )}

        {/* Tier 2: Address + Occupation */}
        {currentTier >= 1 && currentTier < 2 && (
          <Card className="mb-4">
            <h2 className="font-display text-lg text-ink mb-1">Tier 2 — Address & Occupation</h2>
            <p className="text-xs text-ink-soft mb-4">Required for loan applications</p>
            <div className="space-y-3">
              <div>
                <label className="ys-label">RESIDENTIAL ADDRESS</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="ys-input" placeholder="123 Farm Road, Oyo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ys-label">STATE</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className="ys-input">
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ys-label">LGA</label>
                  <input type="text" value={lga} onChange={(e) => setLga(e.target.value)} className="ys-input" placeholder="LGA" />
                </div>
              </div>
              <div>
                <label className="ys-label">OCCUPATION</label>
                <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="ys-input" placeholder="Farmer, Trader, etc." />
              </div>
              <Button onClick={() => handleSave(2)} disabled={saving || !address || !state || !occupation}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & continue"}
              </Button>
            </div>
          </Card>
        )}

        {/* Tier 3: Farm details + Next of Kin */}
        {currentTier >= 2 && currentTier < 3 && (
          <Card className="mb-4">
            <h2 className="font-display text-lg text-ink mb-1">Tier 3 — Full Verification</h2>
            <p className="text-xs text-ink-soft mb-4">Unlocks all features and higher limits</p>
            <div className="space-y-3">
              <div>
                <label className="ys-label">FARM/BUSINESS TYPE</label>
                <select value={farmType} onChange={(e) => setFarmType(e.target.value)} className="ys-input">
                  <option value="">Select type</option>
                  <option value="crop_farming">Crop Farming</option>
                  <option value="livestock">Livestock</option>
                  <option value="poultry">Poultry</option>
                  <option value="fishery">Fishery</option>
                  <option value="agro_processing">Agro-Processing</option>
                  <option value="agro_trading">Agro-Trading</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="ys-label">PRIMARY PRODUCE / GOODS</label>
                <input type="text" value={primaryProduce} onChange={(e) => setPrimaryProduce(e.target.value)} className="ys-input" placeholder="Rice, Maize, Cassava, etc." />
              </div>
              <div className="border-t border-track/30 pt-3 mt-3">
                <p className="text-sm font-medium text-ink mb-3">Next of Kin</p>
                <div>
                  <label className="ys-label">FULL NAME</label>
                  <input type="text" value={nokName} onChange={(e) => setNokName(e.target.value)} className="ys-input" placeholder="Next of kin name" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="ys-label">PHONE</label>
                    <input type="tel" value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} className="ys-input" placeholder="08012345678" />
                  </div>
                  <div>
                    <label className="ys-label">RELATIONSHIP</label>
                    <select value={nokRelationship} onChange={(e) => setNokRelationship(e.target.value)} className="ys-input">
                      <option value="">Select</option>
                      <option value="spouse">Spouse</option>
                      <option value="parent">Parent</option>
                      <option value="sibling">Sibling</option>
                      <option value="child">Child</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <Button onClick={() => handleSave(3)} disabled={saving || !farmType || !primaryProduce || !nokName || !nokPhone || !nokRelationship}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete verification"}
              </Button>
            </div>
          </Card>
        )}

        {/* Fully verified */}
        {currentTier >= 3 && (
          <Card className="text-center py-12">
            <ShieldCheck className="h-12 w-12 text-loam mx-auto mb-3" />
            <h2 className="font-display text-xl text-ink">Fully verified</h2>
            <p className="text-sm text-ink-soft mt-1">You have access to all Agriqcap features.</p>
            <Button className="mt-6" onClick={() => router.push("/dashboard")}>
              Go to dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Card>
        )}

        {error && (
          <p className="text-sm text-clay bg-clay/5 rounded-lg px-3 py-2 mt-4">{error}</p>
        )}

        {/* Skip link — always allow going to dashboard */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-ink-soft hover:text-indigo inline-flex items-center gap-1"
          >
            Skip for now <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { Users, Lock, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

export default function GroupsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Savings Groups</h1>
          <p className="text-sm text-stone-500 mt-0.5">Save together, grow together</p>
        </div>
        <button className="flex items-center gap-1.5 bg-brand-green text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-green-dark">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Create
        </button>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-brand-green rounded-2xl p-6 text-white text-center mb-6">
        <div className="w-12 h-12 rounded-full bg-brand-lime/20 flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6 text-brand-lime" />
        </div>
        <h2 className="text-base font-semibold">Group Savings — Coming Soon</h2>
        <p className="text-sm text-white/70 mt-1.5 max-w-xs mx-auto">
          Rotate contributions with your association, join savings challenges, and build credit with group accountability.
        </p>
      </div>

      {/* What's Coming */}
      <div className="space-y-3">
        <div className="bg-white border border-brand-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-lime/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-brand-green" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">Rotating Cycles</p>
            <p className="text-xs text-stone-400 mt-0.5">Digital esusu — everyone contributes, everyone gets paid in rotation</p>
          </div>
        </div>

        <div className="bg-white border border-brand-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-gold-light flex items-center justify-center flex-shrink-0">
            <span className="text-base">🏆</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">Savings Challenges</p>
            <p className="text-xs text-stone-400 mt-0.5">Compete with friends to hit savings targets — with leaderboards</p>
          </div>
        </div>

        <div className="bg-white border border-brand-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">Emergency Fund Pool</p>
            <p className="text-xs text-stone-400 mt-0.5">Group safety net for unexpected farming expenses</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-6 bg-brand-cream rounded-xl p-4">
        <p className="text-xs text-stone-500">
          Want early access to groups? Start saving personally first — your savings history unlocks group features.
        </p>
        <Link href="/save" className="inline-flex items-center gap-1 text-xs font-medium text-brand-green mt-2 hover:gap-2 transition-all">
          Start saving <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

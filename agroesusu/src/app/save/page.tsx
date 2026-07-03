"use client";

import { useState } from "react";
import { GoalCard } from "@/components/ui/goal-card";
import { Plus, X, Sprout, Tractor, Wheat } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  unlockDate: string;
  type: "goal" | "vault" | "flex";
}

const mockGoals: Goal[] = [
  {
    id: "1",
    name: "Planting Season Inputs",
    targetAmount: 150000,
    currentAmount: 90000,
    unlockDate: "2026-09-15",
    type: "vault",
  },
  {
    id: "2",
    name: "Tractor Fund",
    targetAmount: 200000,
    currentAmount: 50000,
    unlockDate: "2026-12-31",
    type: "goal",
  },
  {
    id: "3",
    name: "Harvest Logistics",
    targetAmount: 80000,
    currentAmount: 20000,
    unlockDate: "2026-10-31",
    type: "vault",
  },
];

const vaultTemplates = [
  { name: "Planting Vault", icon: Sprout, desc: "Save Jan–Mar for seeds & fertilizer" },
  { name: "Growing Vault", icon: Wheat, desc: "Save Apr–Jul for inputs" },
  { name: "Equipment Fund", icon: Tractor, desc: "Save towards machinery" },
];

export default function SavingsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const flexBalance = 15000;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">My Savings</h1>
          <p className="text-sm text-stone-500 mt-0.5">Track your goals and grow your money</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-brand-green text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-green-dark transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Goal
        </button>
      </div>

      {/* Flex Savings Card */}
      <div className="bg-brand-green rounded-2xl p-5 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wide font-medium">Flex Savings</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">₦{flexBalance.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Interest rate</p>
            <p className="text-sm font-medium text-brand-lime mt-0.5">2% p.a.</p>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <h2 className="text-base font-semibold text-stone-900 mb-3">Active Goals</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {mockGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            id={goal.id}
            name={goal.name}
            targetAmount={goal.targetAmount}
            currentAmount={goal.currentAmount}
            unlockDate={goal.unlockDate}
          />
        ))}
      </div>

      {/* Create Goal Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-stone-900">Create Savings Goal</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                <X className="w-4 h-4 text-stone-500" />
              </button>
            </div>

            {/* Vault Templates */}
            <div className="mb-5">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Quick Templates</p>
              <div className="space-y-2">
                {vaultTemplates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.name}
                      onClick={() => {
                        setGoalName(template.name);
                        setSelectedTemplate(template.name);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                        selectedTemplate === template.name
                          ? "border-brand-green bg-brand-green/5"
                          : "border-brand-border hover:border-stone-300"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-brand-lime/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-brand-green" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-900">{template.name}</p>
                        <p className="text-xs text-stone-400">{template.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Goal Name */}
            <div className="mb-4">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Goal Name</label>
              <input
                type="text"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="e.g. Planting Season Inputs"
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-brand-border text-sm focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
              />
            </div>

            {/* Target Amount */}
            <div className="mb-4">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Target Amount</label>
              <div className="relative mt-1.5">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">₦</span>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="150,000"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-brand-border text-sm focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green tabular-nums"
                />
              </div>
            </div>

            {/* Lock Type */}
            <div className="mb-5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2 block">Lock Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button className="px-3 py-2.5 rounded-lg border border-brand-green bg-brand-green/5 text-xs font-medium text-stone-900">
                  No Lock
                </button>
                <button className="px-3 py-2.5 rounded-lg border border-brand-border text-xs font-medium text-stone-600 hover:border-stone-300">
                  Soft Lock
                </button>
                <button className="px-3 py-2.5 rounded-lg border border-brand-border text-xs font-medium text-stone-600 hover:border-stone-300">
                  Hard Lock
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-2">No Lock: withdraw anytime. Soft Lock: lose interest on early withdrawal. Hard Lock: no withdrawal until target date.</p>
            </div>

            <button
              className="w-full bg-brand-green text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-brand-green-dark transition-colors disabled:opacity-50"
              disabled={!goalName || !targetAmount}
            >
              Create Goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

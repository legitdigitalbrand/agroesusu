"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingState, ErrorState, Button, StatusBadge } from "@/components/yield";
import { Plus, Pencil, X } from "lucide-react";

type ProductType = "savings" | "loans" | "investments" | "group-savings";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  is_active: boolean;
  interest_rate: number;
  [key: string]: unknown;
}

export default function AdminProductsPage() {
  const [activeTab, setActiveTab] = useState<ProductType>("savings");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ products: Product[] }>({
    queryKey: ["admin-products", activeTab],
    queryFn: async () => {
      // Use public product endpoints (which have GET handlers) instead of
      // admin-only routes (which only have POST for creation)
      const endpointMap: Record<ProductType, string> = {
        savings: "/api/savings/products",
        loans: "/api/loans/products",
        investments: "/api/investments/products",
        "group-savings": "/api/group-savings/products",
      };
      const res = await fetch(endpointMap[activeTab]);
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const products = data?.products || [];

  const tabs: { key: ProductType; label: string }[] = [
    { key: "savings", label: "Savings" },
    { key: "loans", label: "Loans" },
    { key: "investments", label: "Investments" },
    { key: "group-savings", label: "Group Savings" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Product Configuration</h1>
          <p className="text-sm text-ink-soft mt-0.5">Configure savings, loan, investment, and group savings products</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Product
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-parchment rounded-full p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              activeTab === tab.key ? "bg-indigo text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Product list */}
      {isLoading ? (
        <LoadingState message="Loading products…" />
      ) : error ? (
        <ErrorState message="Couldn't load products" onRetry={() => refetch()} />
      ) : products.length === 0 ? (
        <div className="ys-card text-center py-12">
          <p className="text-ink-soft">No {activeTab.replace("-", " ")} products configured.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create first product
          </Button>
        </div>
      ) : (
        <div className="ys-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-track/60">
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Code</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Name</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Rate</th>
                <th className="text-left text-xs font-medium text-ink-soft uppercase tracking-wide pb-3 pr-4">Status</th>
                <th className="text-right text-xs font-medium text-ink-soft uppercase tracking-wide pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-track/30 last:border-0 hover:bg-parchment/50 transition">
                  <td className="py-3 pr-4 font-mono text-sm text-ink">{product.product_code}</td>
                  <td className="py-3 pr-4 text-sm text-ink font-medium">{product.product_name}</td>
                  <td className="py-3 pr-4 font-mono text-sm text-ink">{product.interest_rate}%</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={product.is_active ? "active" : "locked"} />
                  </td>
                  <td className="py-3 text-right">
                    <button className="text-indigo hover:text-indigo-deep text-sm inline-flex items-center gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateProductModal
          productType={activeTab}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function CreateProductModal({ productType, onClose }: { productType: ProductType; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    product_code: "",
    product_name: "",
    interest_rate: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body = {
      ...form,
      interest_rate: parseFloat(form.interest_rate) || 0,
    };

    const res = await fetch(`/api/admin/products/${productType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create product");
      setLoading(false);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["admin-products", productType] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-paper rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-ink">New {productType.replace("-", " ")} product</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ys-label block mb-1.5">Product Code</label>
            <input
              type="text"
              value={form.product_code}
              onChange={(e) => setForm({ ...form, product_code: e.target.value.toUpperCase() })}
              required
              className="ys-input"
              placeholder="e.g. FLEX-90"
            />
          </div>
          <div>
            <label className="ys-label block mb-1.5">Product Name</label>
            <input
              type="text"
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              required
              className="ys-input"
              placeholder="e.g. 90-Day Fixed Deposit"
            />
          </div>
          <div>
            <label className="ys-label block mb-1.5">Interest Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={form.interest_rate}
              onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
              required
              className="ys-input"
              placeholder="e.g. 12"
            />
          </div>
          <div>
            <label className="ys-label block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="ys-input min-h-[80px]"
              placeholder="Brief description of the product…"
            />
          </div>

          {error && <p className="text-sm text-clay bg-clay/5 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating…" : "Create product"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

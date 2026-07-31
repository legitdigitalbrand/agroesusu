"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatNaira, } from "@/lib/format";
import { SavingsPlan, SavingsContribution } from "@/lib/types";

interface SavingsChartProps {
  contributions: SavingsContribution[];
  savingsPlans: SavingsPlan[];
}

export default function SavingsChart({ contributions, savingsPlans }: SavingsChartProps) {
  // Generate historical data points
  const generateChartData = () => {
    if (!contributions || contributions.length === 0) {
      // If no contributions, show a default starting projection or current balance
      const totalCurrent = savingsPlans.reduce((sum, p) => sum + Number(p.current_balance), 0);
      const today = new Date();
      const data = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i * 5);
        data.push({
          date: d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
          amount: totalCurrent > 0 ? (totalCurrent / 5) * (5 - i) : 0,
        });
      }
      return data;
    }

    // Sort contributions by date
    const sorted = [...contributions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let runningSum = 0;
    const dataPoints = sorted.map((c) => {
      const amt = Number(c.amount);
      if (c.type === "deposit" || c.type === "interest") {
        runningSum += amt;
      } else if (c.type === "withdrawal") {
        runningSum -= amt;
      }
      return {
        date: new Date(c.created_at).toLocaleDateString("en-NG", {
          month: "short",
          day: "numeric",
        }),
        amount: Math.max(0, runningSum),
        rawDate: new Date(c.created_at),
      };
    });

    // If there are too many data points, group them, otherwise return
    if (dataPoints.length > 10) {
      return dataPoints.slice(-10);
    }

    // Ensure we have at least 2 points for a nice line
    if (dataPoints.length === 1) {
      const firstPoint = dataPoints[0];
      const prevDate = new Date(firstPoint.rawDate);
      prevDate.setDate(prevDate.getDate() - 5);
      return [
        {
          date: prevDate.toLocaleDateString("en-NG", { month: "short", day: "numeric" }),
          amount: 0,
        },
        firstPoint,
      ];
    }

    return dataPoints;
  };

  const chartData = generateChartData();
  const totalSavings = savingsPlans.reduce((sum, p) => sum + Number(p.current_balance), 0);

  return (
    <div className="card-surface flex flex-col h-[350px] justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-ink">Savings Growth</h3>
          <p className="text-xs text-ink-soft">Historical view of your active agricultural savings</p>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo/10 text-indigo px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-center">
          Total: {formatNaira(totalSavings)}
        </div>
      </div>

      <div className="flex-1 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#1B5E20" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6B7280" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#6B7280" }}
              tickFormatter={(val) => `₦${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
            />
            <Tooltip
              formatter={(value: number) => [formatNaira(value), "Savings Balance"]}
              contentStyle={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #F3F4F6",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                fontSize: "12px",
              }}
              labelStyle={{ fontWeight: "600", color: "#111827" }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#1B5E20"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorSavings)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

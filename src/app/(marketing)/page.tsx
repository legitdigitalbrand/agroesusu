'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sprout,
  Users,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Percent,
  Coins,
  Wallet,
  Smartphone,
  ChevronRight,
  Zap,
  Building2,
  Calculator,
} from 'lucide-react';

// Animation configurations
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const stats = [
  { value: '50,000+', label: 'Farmers & Agri-preneurs Served', icon: Users },
  { value: '₦2.5 Billion+', label: 'Total Savings Secured', icon: Wallet },
  { value: '₦1.8 Billion+', label: 'Loans Disbursed', icon: TrendingUp },
];

const savingsFeatures = [
  {
    title: 'Multiple Savings Plans',
    description: 'Save as an individual, with your cooperative, or for a specific harvest cycle.',
    icon: Coins,
  },
  {
    title: 'Flexible Auto-Debit',
    description: 'Set daily, weekly, or monthly automations to grow your savings stress-free.',
    icon: Zap,
  },
  {
    title: 'Up to 15% Annual Interest',
    description: 'Watch your wealth grow with some of the most competitive, guaranteed rates in Nigeria.',
    icon: Percent,
  },
  {
    title: 'Dedicated Virtual Accounts',
    description: 'Get your own Agriqcap account number to receive transfers instantly.',
    icon: Building2,
  },
];

const loanFeatures = [
  {
    title: 'Tailored Agricultural Loans',
    description: 'Get credit custom-designed for input purchases, tractor rentals, or trade finance.',
  },
  {
    title: 'Simple 5-Step Application',
    description: 'Apply on your phone or through your cooperative group in under 10 minutes.',
  },
  {
    title: 'Competitive, Fair Rates',
    description: 'No hidden fees or predatory terms. We keep interest rates low to support food security.',
  },
  {
    title: 'Flexible Harvest Repayment',
    description: 'Align your loan repayment schedule with your actual crop harvest cycles.',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Create Your Account',
    description: 'Download the app or sign up on our website. It takes less than 3 minutes to complete onboarding.',
  },
  {
    step: '02',
    title: 'Save or Apply',
    description: 'Start a cooperative savings circle or apply for an agro-loan with minimal paperwork.',
  },
  {
    step: '03',
    title: 'Harvest & Grow',
    description: 'Earn competitive returns, complete your harvest, and expand your agribusiness with ease.',
  },
];

const whyChooseUs = [
  {
    title: 'Cooperative-First Design',
    description: 'We digitize and elevate local "Esusu" cooperative contributions, making them secure and transparent.',
    icon: Users,
  },
  {
    title: 'Bank-Grade Security',
    description: 'Your savings are secured with multi-factor authentication, data encryption, and robust firewalls.',
    icon: ShieldCheck,
  },
  {
    title: 'Licensed Banking Partner',
    description: 'All deposits are safely held at Safe Haven Microfinance Bank, fully insured by the NDIC.',
    icon: Building2,
  },
  {
    title: 'Mobile & USSD Access',
    description: 'Access your account on smartphones or basic phones via our secure USSD channel.',
    icon: Smartphone,
  },
];

export default function Homepage() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-parchment/80 via-white to-white pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-indigo/10 blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-ochre/10 blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column (Copy) */}
            <motion.div
              className="lg:col-span-7 space-y-8"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={fadeIn} className="inline-flex items-center space-x-2 bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
                <span className="flex h-2 w-2 rounded-full bg-indigo animate-pulse"></span>
                <span className="text-sm font-semibold text-indigo">Agriqcap Savings & Loans</span>
              </motion.div>

              <motion.h1
                variants={fadeIn}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-none"
              >
                Save Together. <br />
                <span className="text-indigo">Grow Together.</span>
              </motion.h1>

              <motion.p
                variants={fadeIn}
                className="text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed"
              >
                The digital savings and affordable lending platform tailored specifically for 
                Nigerian farmers, agricultural cooperatives, and food businesses. Secure your 
                future, protect your harvest, and expand your yield.
              </motion.p>

              <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup" className="btn-primary text-center justify-center flex items-center gap-2 py-3.5 px-8 text-base">
                  Get Started <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/features" className="btn-secondary text-center justify-center flex items-center gap-2 py-3.5 px-8 text-base bg-white border border-gray-200 hover:bg-gray-50">
                  Learn More
                </Link>
              </motion.div>

              {/* Trust Badge */}
              <motion.div variants={fadeIn} className="flex items-center space-x-3 text-sm text-gray-500 pt-4">
                <ShieldCheck className="h-5 w-5 text-indigo" />
                <span>Licensed by CBN partner bank • Deposits insured by NDIC</span>
              </motion.div>
            </motion.div>

            {/* Right Column (Visual/Graphic) */}
            <motion.div
              className="lg:col-span-5 relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative mx-auto max-w-sm lg:max-w-none">
                {/* Decorative Elements */}
                <div className="absolute -top-6 -left-6 w-12 h-12 bg-ochre rounded-xl rotate-12 -z-10 shadow-lg"></div>
                <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-indigo rounded-full -z-10 blur-xl opacity-50"></div>

                {/* Simulated App Screen (Fintech Card Deck) */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-6 relative overflow-hidden">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400">Total Agriqcap Balance</p>
                      <h3 className="text-2xl font-bold text-gray-900">₦1,450,000.00</h3>
                    </div>
                    <span className="bg-indigo/10 text-indigo text-xs font-bold px-2.5 py-1 rounded-lg">
                      +12.4% return
                    </span>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Savings Circles</p>
                    {/* Circle Card */}
                    <div className="flex items-center justify-between p-3 bg-parchment rounded-xl border border-ochre/20">
                      <div className="flex items-center space-x-3">
                        <div className="bg-indigo text-white p-2 rounded-lg">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Ogun Rice Cooperative</p>
                          <p className="text-xs text-gray-500">12 Farmers • Target: ₦2.4M</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-indigo">₦1,800,000</span>
                    </div>

                    {/* Loan Calculator Promo */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-500">Seed Loan Limit</span>
                        <span className="text-indigo font-bold">₦500,000 max</span>
                      </div>
                      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo h-2 w-3/4 rounded-full"></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Rate: 1.5% monthly</span>
                        <span>Term: 6 months</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick features badge */}
                  <div className="flex gap-2 pt-2">
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Instant Pay-out
                    </span>
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 flex items-center gap-1 font-medium">
                      <Calculator className="h-3.5 w-3.5" /> Flexible Terms
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-indigo text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white rounded-full blur-2xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="space-y-2 p-4"
              >
                <div className="mx-auto bg-white/10 w-12 h-12 rounded-full flex items-center justify-center text-ochre mb-2">
                  <stat.icon className="h-6 w-6" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-ochre">{stat.value}</h3>
                <p className="text-sm sm:text-base text-gray-100 max-w-xs mx-auto">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Savings Section */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left side graphics */}
            <div className="lg:col-span-5 order-2 lg:order-1">
              <div className="bg-parchment border border-ochre/10 rounded-2xl p-6 space-y-6 shadow-sm">
                <h4 className="font-bold text-gray-900 text-lg">Agriqcap Savings Plans</h4>
                <div className="space-y-4">
                  {/* Item 1 */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="bg-amber-100 text-amber-700 p-2.5 rounded-lg">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-gray-900">Cooperative "Esusu"</h5>
                        <p className="text-xs text-gray-500">Save with a group & rotate payouts</p>
                      </div>
                    </div>
                    <span className="text-indigo text-xs font-semibold px-2 py-1 bg-indigo/5 rounded-lg">
                      12% Interest
                    </span>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-lg">
                        <Sprout className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-gray-900">Harvest Fixed Deposit</h5>
                        <p className="text-xs text-gray-500">Lock funds until harvest period</p>
                      </div>
                    </div>
                    <span className="text-indigo text-xs font-semibold px-2 py-1 bg-indigo/5 rounded-lg">
                      15% Interest
                    </span>
                  </div>

                  {/* Item 3 */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 text-blue-700 p-2.5 rounded-lg">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-gray-900">Daily Farm Savings</h5>
                        <p className="text-xs text-gray-500">Flexible pull, anytime access</p>
                      </div>
                    </div>
                    <span className="text-indigo text-xs font-semibold px-2 py-1 bg-indigo/5 rounded-lg">
                      8% Interest
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side copy */}
            <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
              <div className="inline-flex items-center space-x-2 bg-ochre/10 px-3 py-1 rounded-full border border-ochre/20 text-ochre-dim text-sm font-semibold">
                <span>Secure Savings Plans</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Secure your profit. <br />
                Earn industry-leading interest.
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Whether you're a single cash crop farmer, an import/export aggregator, or a local cooperative, 
                Agriqcap offers tailor-made digital accounts to pool contributions and secure your money. 
                We remove the traditional hassle of high banking charges and complex paperwork.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {savingsFeatures.map((feat, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="bg-indigo/10 text-indigo p-2 h-10 w-10 rounded-xl shrink-0 flex items-center justify-center">
                      <feat.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{feat.title}</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{feat.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link href="/savings-plans" className="inline-flex items-center font-bold text-indigo hover:text-indigo-deep transition-colors gap-2">
                  Explore Savings Plans <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Loans Section */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left side copy */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center space-x-2 bg-indigo/10 px-3 py-1 rounded-full border border-indigo/20 text-indigo text-sm font-semibold">
                <span>Flexible Agro Loans</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Affordable credit to fund your <br />
                entire farming season.
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Traditional banks demand heavy collateral and impossible interest rates. 
                Agriqcap provides simple, responsive agricultural financing tailored to 
                your planting, maintenance, and harvesting timelines. No hidden charges.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                {loanFeatures.map((feat, idx) => (
                  <div key={idx} className="flex gap-2">
                    <CheckCircle2 className="h-5 w-5 text-ochre shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{feat.title}</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{feat.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link href="/loan-plans" className="inline-flex items-center font-bold text-indigo hover:text-indigo-deep transition-colors gap-2">
                  Calculate Your Loan <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
            </div>

            {/* Right side illustration */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-gray-100 shadow-lg rounded-2xl p-6 space-y-6">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <h4 className="font-bold text-gray-900 text-sm">Interactive Loan Estimate</h4>
                  <span className="text-xs text-indigo bg-indigo/5 px-2 py-0.5 rounded-lg font-bold">Fertilizer & Input Loan</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500 font-medium">
                      <span>Requested Amount</span>
                      <span className="text-gray-900 font-bold">₦250,000</span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full">
                      <div className="bg-indigo h-2 w-1/2 rounded-full"></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500 font-medium">
                      <span>Duration (Months)</span>
                      <span className="text-gray-900 font-bold">6 Months</span>
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full">
                      <div className="bg-ochre h-2 w-3/5 rounded-full"></div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
                    <div className="bg-parchment p-3 rounded-lg border border-ochre/10 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Monthly Repayment</p>
                      <h5 className="text-lg font-extrabold text-indigo mt-1">₦45,416</h5>
                    </div>
                    <div className="bg-parchment p-3 rounded-lg border border-ochre/10 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Interest Rate</p>
                      <h5 className="text-lg font-extrabold text-ochre-dim mt-1">1.5% <span className="text-xs font-normal">/mo</span></h5>
                    </div>
                  </div>
                </div>

                <Link href="/signup" className="btn-primary w-full text-center justify-center py-2.5">
                  Apply for Loans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Start in 3 Easy Steps
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Agriqcap is designed to be straightforward and clear. Here is how you can begin 
              saving and unlocking farming capital today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Steps */}
            {howItWorks.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all relative group"
              >
                <div className="text-5xl font-extrabold text-ochre/20 group-hover:text-ochre/35 transition-colors absolute top-6 right-6">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 pt-4">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <div className="inline-flex items-center space-x-2 bg-indigo/10 px-3 py-1 rounded-full border border-indigo/20 text-indigo text-sm font-semibold">
              <span>Why Agriqcap</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Built Specifically for Agriculture
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Unlike generic commercial banking platforms, we understand the seasonal reality, 
              cooperative community networks, and cash flow constraints of the food supply chain.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyChooseUs.map((item, idx) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all space-y-4">
                <div className="bg-indigo/10 text-indigo p-3 rounded-lg w-12 h-12 flex items-center justify-center shrink-0">
                  <item.icon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-gray-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-indigo to-indigo-deep text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 left-0 w-96 h-96 bg-ochre rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-ochre rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Ready to grow your farm or cooperative?
            </h2>
            <p className="text-lg sm:text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">
              Join thousands of Nigerian farmers and agricultural cooperative groups who are 
              saving smarter and growing their food businesses with Agriqcap.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <Link href="/signup" className="btn-secondary bg-ochre text-gray-900 font-bold hover:bg-ochre-light py-4 px-8 text-base">
              Get Started for Free
            </Link>
            <Link href="/contact" className="btn-ghost text-white border border-white/20 hover:bg-white/10 py-4 px-8 text-base">
              Talk to Our Team
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-xs text-gray-300"
          >
            Available on iOS, Android, and USSD code. No minimum opening balance required.
          </motion.p>
        </div>
      </section>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Mail, Phone, MapPin, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const [formData, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cooperative: '',
    subject: 'Savings Inquiry',
    message: '',
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API submission
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 1200);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-paper">
      {/* Page Header */}
      <section className="bg-gradient-to-b from-parchment/80 to-paper py-16 md:py-24 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold text-indigo uppercase tracking-widest bg-indigo/10 px-4 py-1.5 rounded-full border border-indigo/20">
            Get In Touch
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight max-w-3xl mx-auto">
            We are Here to Support Your Agricultural Journey
          </h1>
          <p className="text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Have questions about group saving circles, farming credit options, or offline USSD codes? 
            Reach out to our multilingual agents today.
          </p>
        </div>
      </section>

      {/* Main Grid: Contact Form + Info */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Contact Details (Left Column) */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-ink">Headquarters & Support Hubs</h2>
              <p className="text-sm text-ink-soft leading-relaxed">
                Our support channels are active 24/7. We respond in English, Yoruba, Hausa, Igbo, and Pidgin.
              </p>
            </div>

            {/* Direct Channels */}
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="bg-indigo/10 text-indigo p-3 rounded-xl shrink-0 h-12 w-12 flex items-center justify-center">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-sm">Call Us Directly</h4>
                  <p className="text-xs text-ink-soft mt-1">General enquiries & cooperative setup support</p>
                  <span className="text-sm font-bold text-indigo block mt-1">+234 (0) 1 234 5678</span>
                  <span className="text-sm font-bold text-indigo block">+234 (0) 803 123 4567</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-indigo/10 text-indigo p-3 rounded-xl shrink-0 h-12 w-12 flex items-center justify-center">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-sm">Email Our Desk</h4>
                  <p className="text-xs text-ink-soft mt-1">Submit documents or ask complex technical questions</p>
                  <span className="text-sm font-bold text-indigo block mt-1">support@agriqcap.com</span>
                  <span className="text-sm font-bold text-indigo block">info@agriqcap.com</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-indigo/10 text-indigo p-3 rounded-xl shrink-0 h-12 w-12 flex items-center justify-center">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-sm">Main Office</h4>
                  <p className="text-xs text-ink-soft mt-1">Visit us in Victoria Island</p>
                  <span className="text-sm font-semibold text-ink block mt-1">
                    8 Adeola Hopewell St, Victoria Island, Lagos, Nigeria
                  </span>
                </div>
              </div>
            </div>

            {/* Regional Extension Centers */}
            <div className="border-t border-line pt-8 space-y-4">
              <h4 className="font-bold text-ink text-sm">Regional Extension Hubs</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-parchment p-3 rounded-xl border border-line">
                  <span className="font-bold text-ink block">Kano Hub</span>
                  <span className="text-ink-soft block mt-1">45 Zoo Road, Kano State</span>
                </div>
                <div className="bg-parchment p-3 rounded-xl border border-line">
                  <span className="font-bold text-ink block">Ibadan Center</span>
                  <span className="text-ink-soft block mt-1">12 Ring Road, Ibadan, Oyo State</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form (Right Column) */}
          <div className="lg:col-span-7">
            <div className="card-surface border border-line shadow-lg p-8">
              {isSubmitted ? (
                <div className="text-center py-12 space-y-6 animate-in fade-in duration-300">
                  <div className="bg-emerald-100 text-emerald-700 h-16 w-14 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-indigo" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-ink">Thank you! Message Sent</h3>
                    <p className="text-sm text-ink-soft max-w-sm mx-auto leading-relaxed">
                      We have received your request successfully. An Agriqcap representative will 
                      contact you within 2-4 working hours on your phone number or email address.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="btn-primary"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-ink">Send an Online Inquiry</h3>
                    <p className="text-xs text-ink-soft">Fill in the details below and our team will get right back to you.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="name" className="text-xs font-bold text-ink-soft">Full Name</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="e.g. Kolawole Ibrahim"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="phone" className="text-xs font-bold text-ink-soft">Phone Number</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="e.g. +234 803 123 4567"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-xs font-bold text-ink-soft">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="e.g. k.ibrahim@gmail.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="cooperative" className="text-xs font-bold text-ink-soft">Cooperative Name <span className="text-ink-soft font-normal">(Optional)</span></label>
                      <input
                        type="text"
                        id="cooperative"
                        name="cooperative"
                        value={formData.cooperative}
                        onChange={handleChange}
                        className="input-field"
                        placeholder="e.g. Ogun Rice Farmers Union"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="subject" className="text-xs font-bold text-ink-soft">What do you need help with?</label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className="input-field py-3"
                    >
                      <option value="Savings Inquiry">Savings Plans & Group Esusu</option>
                      <option value="Loan Application">Agricultural Loans & Input Financing</option>
                      <option value="Technical Issue">Mobile App or USSD Code Issues</option>
                      <option value="Partnership">Agro-dealer / Supplier Partnership</option>
                      <option value="General">Other / General Enquiries</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="message" className="text-xs font-bold text-ink-soft">Your Message</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      required
                      value={formData.message}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="Please details your inquiry here..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Sending Inquiry...' : 'Submit Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

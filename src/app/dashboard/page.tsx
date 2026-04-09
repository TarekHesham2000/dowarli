'use client';

import Link from 'next/link';
import { ArrowRight, Building2, BarChart3, Users } from 'lucide-react';

export default function DashboardHome() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-border px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-primary">Dowrly</h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="text-foreground hover:text-primary transition-colors">Docs</a>
          <a href="#" className="text-foreground hover:text-primary transition-colors">Support</a>
          <button className="px-4 py-2 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-foreground mb-6">Real Estate Management Dashboard</h2>
          <p className="text-xl text-muted mb-12 max-w-2xl mx-auto">
            Manage your property portfolio with confidence. Track listings, leads, and analytics in one clean, intuitive platform.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/dashboard-demo"
              className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-opacity-90 transition-colors inline-flex items-center gap-2"
            >
              View Dashboard <ArrowRight size={20} />
            </Link>
            <a
              href="#features"
              className="px-8 py-3 border-2 border-primary text-primary rounded-lg font-medium hover:bg-primary hover:text-white transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 bg-secondary p-8 rounded-lg border border-border">
          <div className="text-center">
            <p className="text-sm text-muted font-medium mb-2">Active Properties</p>
            <p className="text-4xl font-bold text-primary">24</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted font-medium mb-2">Total Revenue</p>
            <p className="text-4xl font-bold text-primary">$125K</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted font-medium mb-2">Active Leads</p>
            <p className="text-4xl font-bold text-primary">18</p>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="space-y-12">
          <h3 className="text-3xl font-bold text-foreground text-center mb-12">Platform Features</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border border-border rounded-lg p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center mb-4">
                <Building2 size={24} className="text-primary" />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-3">Property Management</h4>
              <p className="text-muted">Efficiently manage your entire property portfolio. List, edit, and track all your properties in one place with comprehensive details.</p>
            </div>

            <div className="bg-white border border-border rounded-lg p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center mb-4">
                <Users size={24} className="text-primary" />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-3">Lead Management</h4>
              <p className="text-muted">Track and nurture leads effortlessly. Monitor inquiries, manage communications, and convert prospects into successful transactions.</p>
            </div>

            <div className="bg-white border border-border rounded-lg p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center mb-4">
                <BarChart3 size={24} className="text-primary" />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-3">Analytics & Insights</h4>
              <p className="text-muted">Get actionable insights with detailed analytics. Monitor performance metrics and make data-driven decisions for your business.</p>
            </div>
          </div>
        </div>

        {/* Dashboard Navigation Cards */}
        <div className="mt-20 space-y-4">
          <h3 className="text-2xl font-bold text-foreground mb-8">Explore Dashboard Sections</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/dashboard-demo"
              className="p-6 bg-white border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-lg mb-1">Dashboard Overview</h4>
                  <p className="text-sm opacity-75">View all key metrics and recent activity</p>
                </div>
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/dashboard-demo/properties"
              className="p-6 bg-white border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-lg mb-1">Property Portfolio</h4>
                  <p className="text-sm opacity-75">Manage and monitor all your listings</p>
                </div>
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/dashboard-demo/leads"
              className="p-6 bg-white border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-lg mb-1">Leads Management</h4>
                  <p className="text-sm opacity-75">Track and engage your property inquiries</p>
                </div>
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/dashboard-demo/analytics"
              className="p-6 bg-white border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-lg mb-1">Performance Analytics</h4>
                  <p className="text-sm opacity-75">Detailed insights and performance metrics</p>
                </div>
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary mt-20 py-12">
        <div className="max-w-6xl mx-auto px-8 text-center text-muted">
          <p className="mb-2">© 2024 Dowrly. All rights reserved.</p>
          <p className="text-sm">Premium Real Estate Management Platform</p>
        </div>
      </footer>
    </div>
  );
}

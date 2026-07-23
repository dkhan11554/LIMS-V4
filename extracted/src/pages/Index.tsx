import { Link } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { FlaskConical, ShieldCheck, BarChart3, ArrowRight } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src="https://hercules-cdn.com/file_ufv3tHxtGCOHOupKSBftfiVK"
            alt="AI-DATA"
            className="w-9 h-9 rounded-lg object-cover"
          />
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight">LIMS</span>
            <span className="text-muted-foreground text-xs leading-tight">AI Data Software Solutions LLC</span>
          </div>
        </div>
        <Authenticated>
          <Button asChild size="sm">
            <Link to="/dashboard">Go to Dashboard <ArrowRight size={14} className="ml-1" /></Link>
          </Button>
        </Authenticated>
        <Unauthenticated>
          <SignInButton />
        </Unauthenticated>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <FlaskConical size={12} />
          AI-Powered Laboratory Information Management
        </div>

        {/* Logo centrepiece */}
        <div className="flex justify-center mb-6">
          <img
            src="https://hercules-cdn.com/file_ufv3tHxtGCOHOupKSBftfiVK"
            alt="AI-DATA"
            className="w-24 h-24 rounded-2xl object-cover shadow-lg"
          />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance mb-3">
          Laboratory Information<br className="hidden md:block" /> Management System
        </h1>
        <p className="text-base text-primary font-semibold mb-5">
          Powered by AI Data Software Solutions LLC
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
          From sample registration to COA generation. Manage your entire laboratory workflow with full audit trails, electronic signatures, and AI-powered insights.
        </p>
        <Unauthenticated>
          <SignInButton />
        </Unauthenticated>
        <Authenticated>
          <Button size="lg" asChild>
            <Link to="/dashboard">Open Dashboard <ArrowRight size={16} className="ml-1" /></Link>
          </Button>
        </Authenticated>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-5 mt-20 text-left">
          {[
            {
              icon: <FlaskConical size={20} className="text-blue-500" />,
              title: "Full Sample Lifecycle",
              desc: "Register, track, test, review, approve, and deliver — every step with complete traceability.",
            },
            {
              icon: <ShieldCheck size={20} className="text-green-500" />,
              title: "Built for Compliance",
              desc: "Electronic signatures, 21 CFR Part 11-ready audit trails, OOS investigation workflows.",
            },
            {
              icon: <BarChart3 size={20} className="text-purple-500" />,
              title: "AI Copilot & Analytics",
              desc: "Natural language queries, predictive turnaround times, and OOS risk scoring.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-5">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer credit */}
        <p className="mt-16 text-xs text-muted-foreground">
          © {new Date().getFullYear()} AI Data Software Solutions LLC — All rights reserved.
        </p>
      </main>
    </div>
  );
}

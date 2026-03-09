import { Check } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "$19",
    period: "/mo",
    screens: "Up to 3 screens",
    features: ["3 screens", "5 GB storage", "Basic scheduling", "Email support"],
    current: false,
    popular: false,
  },
  {
    name: "Business",
    price: "$49",
    period: "/mo",
    screens: "Up to 15 screens",
    features: ["15 screens", "50 GB storage", "Advanced scheduling", "Priority support", "Custom branding", "Analytics"],
    current: true,
    popular: true,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/mo",
    screens: "Unlimited screens",
    features: ["Unlimited screens", "500 GB storage", "Advanced scheduling", "24/7 support", "Custom branding", "Analytics", "API access", "SSO"],
    current: false,
    popular: false,
  },
];

export default function BillingPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your subscription</p>
        </div>

        {/* Current plan info */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-lg font-semibold text-foreground">Business</p>
              <p className="text-xs text-muted-foreground mt-1">Next billing: April 9, 2026</p>
            </div>
            <Button variant="outline">Manage Subscription</Button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "bg-card border rounded-lg p-6 relative",
                plan.popular ? "border-primary" : "border-border"
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                  Current Plan
                </span>
              )}
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{plan.screens}</p>

              <ul className="mt-5 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success shrink-0" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full mt-6"
                variant={plan.current ? "secondary" : "default"}
                disabled={plan.current}
              >
                {plan.current ? "Current Plan" : "Upgrade"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

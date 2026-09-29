import Link from "next/link";

import { Button } from "@/components/ui/button";

import { UserAuthForm } from "@/components/user-auth-form";

import { AuthSidePanel, AuthTerms, BrandMark, TrackGrievanceLink } from "../auth-brand";

export const metadata = {
  title: "Sign in · Sahayak",
  description:
    "Sign in to Sahayak, the multilingual help desk for cooperative members and farmers.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh">
      <AuthSidePanel />
      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <Button asChild variant="ghost" className="absolute right-4 top-4 md:right-2 md:top-2">
          <Link href="/register">Create account</Link>
        </Button>
        <div className="w-full max-w-[350px] space-y-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <BrandMark className="lg:hidden" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to continue to Sahayak</p>
            </div>
          </div>
          <UserAuthForm type="login" />
          <div className="flex justify-center lg:hidden">
            <TrackGrievanceLink className="text-green-700 dark:text-green-400" />
          </div>
          <AuthTerms />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

import { Button } from "@/components/ui/button";

import { UserAuthForm } from "@/components/user-auth-form";

import { AuthSidePanel, AuthTerms, BrandMark, TrackGrievanceLink } from "../auth-brand";

export const metadata = {
  title: "Create an account · Sahayak",
  description:
    "Create a Sahayak account to ask questions, file grievances and follow their status.",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh">
      <AuthSidePanel />
      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <Button asChild variant="ghost" className="absolute right-4 top-4 md:right-2 md:top-2">
          <Link href="/login">Sign in</Link>
        </Button>
        <div className="w-full max-w-[350px] space-y-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <BrandMark className="lg:hidden" />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
              <p className="text-sm text-muted-foreground">
                Sign up to ask questions and file grievances
              </p>
            </div>
          </div>
          <UserAuthForm type="register" />
          <div className="flex justify-center lg:hidden">
            <TrackGrievanceLink className="text-green-700 dark:text-green-400" />
          </div>
          <AuthTerms />
        </div>
      </div>
    </div>
  );
}

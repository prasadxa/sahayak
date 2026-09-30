"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/icons";

import { cn } from "@/lib/utils";

import { useAuthActions } from "@convex-dev/auth/react";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  type: "login" | "register";
}

export const UserAuthForm = ({ className, type, ...props }: UserAuthFormProps) => {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      await signIn("google", { redirectTo: "/" });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setIsPasswordLoading(true);
      // `redirectTo` only applies to OAuth/magic-link flows; for the Password
      // provider we navigate ourselves once tokens are issued. `signingIn` is
      // false when credentials are rejected (no exception is thrown).
      const result = await signIn("password", {
        email,
        password,
        flow: type === "login" ? "signIn" : "signUp",
        redirectTo: "/",
      });
      if (result?.signingIn) {
        router.push("/");
        router.refresh();
        return;
      }
      setError(
        type === "login"
          ? "Invalid email or password"
          : "Could not create account — try a different email or a stronger password"
      );
    } catch {
      setError(
        type === "login"
          ? "Invalid email or password"
          : "Could not create account — try a different email or a stronger password"
      );
    } finally {
      setIsPasswordLoading(false);
    }
  };

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={handlePasswordSignIn} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={type === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={isPasswordLoading} className="w-full">
          {isPasswordLoading && (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          )}
          {type === "login" ? "Sign in" : "Sign up"} with email
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
        className="w-full"
      >
        {isGoogleLoading ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 h-4 w-4" />
        )}
        {type === "login" ? "Sign in" : "Sign up"} with Google
      </Button>
    </div>
  );
};

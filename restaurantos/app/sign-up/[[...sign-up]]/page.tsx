import Link from "next/link";
import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/" aria-label="RestaurantOS">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span>restaurant<span className="brand-os">OS</span></span>
      </Link>
      <Suspense fallback={<p role="status">Loading sign up...</p>}>
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/"
          appearance={{
            variables: {
              colorPrimary: "#A67C52",
              colorBackground: "#1C1714",
              colorText: "#F5EDE6",
            },
          }}
        />
      </Suspense>
    </main>
  );
}

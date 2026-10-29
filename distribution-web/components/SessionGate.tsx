"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000";

type AuthStatus = "loading" | "yes" | "no";

export default function SessionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  const [auth, setAuth] = useState<{
    path: string;
    status: AuthStatus;
  }>({
    path: pathname,
    status: "loading",
  });

  useEffect(() => {
    if (isLoginPage) return;

    const controller = new AbortController();

    fetch(`${API}/api/auth/me`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Not authenticated");
        }

        return response.json();
      })
      .then(() => {
        if (!controller.signal.aborted) {
          setAuth({
            path: pathname,
            status: "yes",
          });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;

        setAuth({
          path: pathname,
          status: "no",
        });

        router.replace("/login");
      });

    return () => {
      controller.abort();
    };
  }, [pathname, isLoginPage, router]);

  // Login page must remain accessible.
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Never show protected page content before authentication.
  const status =
    auth.path === pathname ? auth.status : "loading";

  if (status !== "yes") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <p>
          {status === "no"
            ? "Redirecting to login..."
            : "Checking session..."}
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
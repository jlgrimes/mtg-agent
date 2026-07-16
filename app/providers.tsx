"use client";

import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import Link from "next/link";
import type { ReactNode } from "react";

// Astryx design-system providers: theme tokens + next/link for all Astryx
// components that render links (SideNavItem, Button href, etc.).
export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <Theme theme={neutralTheme}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}

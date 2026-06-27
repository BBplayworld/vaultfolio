"use client";

import { useEffect } from "react";

export default function AssetRedirectPage() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/" + window.location.hash);
    }
  }, []);

  return null;
}

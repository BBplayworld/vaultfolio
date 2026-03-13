"use client";

import { redirect } from "next/navigation";


export default function DashboardNotFound() {
  redirect("/asset");
}

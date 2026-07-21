import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVASServices, getVASServiceCategories, getVASCategoryProducts } from "@/lib/safehaven";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.PAYMENT_PROVIDER !== "safehaven") {
    return NextResponse.json({ error: "VAS services require Safe Haven as payment provider" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const categoryId = searchParams.get("categoryId");

  try {
    // If categoryId is provided, return products for that category
    if (categoryId) {
      const products = await getVASCategoryProducts(categoryId);
      return NextResponse.json({ products });
    }

    // If serviceId is provided, return categories for that service
    if (serviceId) {
      const categories = await getVASServiceCategories(serviceId);
      return NextResponse.json({ categories });
    }

    // Otherwise return all services
    const services = await getVASServices();
    return NextResponse.json({ services });
  } catch (error: any) {
    console.error("VAS services error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch VAS services" }, { status: 500 });
  }
}

import { SaboreApp } from "@/components/sabore-app";
import { getSaboreData } from "@/lib/supabase/sabore-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await getSaboreData();

  return (
    <SaboreApp
      initialData={result.data}
      dataSource={{ source: result.source, message: result.message }}
    />
  );
}

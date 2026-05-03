import { SaboreApp } from "@/components/sabore-app";
import { demoData } from "@/lib/demo-data";

export default function Home() {
  return <SaboreApp initialData={demoData} />;
}

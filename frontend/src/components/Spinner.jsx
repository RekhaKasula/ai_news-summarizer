import { Loader2 } from "lucide-react";

export default function Spinner({ size = 20, label = "Loading" }) {
  return <Loader2 size={size} className="animate-spin" role="status" aria-label={label} />;
}

export function Card({ className = "", ...props }) {
  return <div className={["border border-slate-200 bg-white", className].join(" ")} {...props} />;
}
export function CardContent({ className = "", ...props }) {
  return <div className={className} {...props} />;
}

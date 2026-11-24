export function StatusCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <article className={`status-card status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
